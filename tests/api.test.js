import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import {
  hashPassword,
  randomToken,
  PASSWORD_ITERATIONS,
} from "../server/utils/crypto.js";
import { stringifyCSV, CSV_COLUMNS } from "../server/services/csv.js";

let mf, db, password, originalAdmin;
const origin = "http://localhost";
const song = (overrides = {}) => ({
  title: "테스트용 노래",
  artist: "검증용 가수",
  description: "테스트 설명",
  genre: "발라드",
  language: "한국어",
  proficiency: 3,
  practice_status: "practicing",
  balloon_cost: 25,
  memo: "PRIVATE_TEST_MEMO",
  is_public: true,
  ...overrides,
});
async function request(path, method = "GET", body, auth, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (method !== "GET") headers.Origin ??= origin;
  if (body && typeof body !== "string" && !(body instanceof Uint8Array)) {
    body = JSON.stringify(body);
    headers["Content-Type"] ??= "application/json";
  }
  if (auth) {
    headers.Cookie = auth.cookie;
    headers["X-CSRF-Token"] = auth.csrfToken;
  }
  const response = await mf.dispatchFetch(origin + path, {
    method,
    body,
    headers,
    redirect: "manual",
  });
  // Drain the real HTTP response even when a test only checks its status.
  // This avoids leaving unread response streams between Miniflare requests on Windows.
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: response.headers,
  });
}
async function login() {
  const response = await request("/api/admin/login", "POST", {
    username: "test-admin",
    password,
  });
  assert.equal(response.status, 200, await response.clone().text());
  const data = await response.json();
  return {
    cookie: response.headers.get("Set-Cookie").split(";")[0],
    csrfToken: data.csrfToken,
  };
}
async function create(auth, data = song()) {
  const response = await request("/api/admin/songs", "POST", data, auth);
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
}
before(async () => {
  const bundled = await build({
    entryPoints: ["server/index.js"],
    bundle: true,
    format: "esm",
    write: false,
    platform: "browser",
    target: "es2022",
  });
  mf = new Miniflare({
    modules: true,
    script: bundled.outputFiles[0].text,
    compatibilityDate: "2026-07-30",
    d1Databases: ["DB"],
    bindings: { APP_ENV: "test" },
  });
  db = await mf.getD1Database("DB");
  for (const file of [
    "0001_initial.sql",
    "0002_security_and_indexes.sql",
    "0003_admin_password_change.sql",
  ]) {
    const sql = await readFile(`migrations/${file}`, "utf8");
    for (const statement of sql
      .replace(/^--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(statement).run();
  }
  password = randomToken();
  const salt = randomToken();
  await db
    .prepare(
      "INSERT INTO admin_users(username,display_name,password_hash,password_salt,password_iterations) VALUES (?,?,?,?,?)",
    )
    .bind(
      "test-admin",
      "테스트 관리자",
      await hashPassword(password, salt),
      salt,
      PASSWORD_ITERATIONS,
    )
    .run();
});
beforeEach(async () => {
  originalAdmin ??= await db
    .prepare("SELECT * FROM admin_users WHERE username=?")
    .bind("test-admin")
    .first();
  await db
    .prepare(
      "UPDATE admin_users SET password_hash=?, password_salt=?, is_active=1, must_change_password=0 WHERE username=?",
    )
    .bind(
      originalAdmin.password_hash,
      originalAdmin.password_salt,
      "test-admin",
    )
    .run();
  await db.batch(
    [
      "DELETE FROM songs",
      "DELETE FROM admin_sessions",
      "DELETE FROM login_limits",
      "DELETE FROM admin_users WHERE username <> 'test-admin'",
    ].map((sql) => db.prepare(sql)),
  );
});
after(async () => {
  await mf?.dispose();
});

test("health distinguishes Worker and database, unknown API remains JSON", async () => {
  assert.deepEqual(await (await request("/api/health")).json(), {
    ok: true,
    database: "not_checked",
  });
  assert.deepEqual(await (await request("/api/health?db=1")).json(), {
    ok: true,
    database: "ready",
  });
  const missing = await request("/api/missing");
  assert.equal(missing.status, 404);
  assert.ok(missing.headers.get("Content-Type").includes("application/json"));
});
test("anonymous users cannot access any admin read, write, CSV or initialization endpoint", async () => {
  for (const [method, path] of [
    ["GET", "/songs"],
    ["POST", "/songs"],
    ["PATCH", "/songs/1"],
    ["DELETE", "/songs/1"],
    ["GET", "/songs/export.csv"],
    ["POST", "/songs/import/preview"],
    ["POST", "/songs/import"],
    ["GET", "/me"],
    ["POST", "/register"],
  ]) {
    const response = await request(
      "/api/admin" + path,
      method,
      method === "GET" ? undefined : {},
    );
    assert.equal(response.status, 401, path);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});
test("login uses generic errors, hashes session tokens, sets cookie flags, checks Origin and CSRF", async () => {
  for (const username of ["test-admin", "unknown"]) {
    const response = await request("/api/admin/login", "POST", {
      username,
      password: "bad",
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "LOGIN_FAILED");
  }
  assert.equal(
    (
      await request(
        "/api/admin/login",
        "POST",
        { username: "test-admin", password },
        null,
        { Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  const auth = await login();
  const raw = auth.cookie.split("=")[1];
  const stored = await db
    .prepare("SELECT token_hash FROM admin_sessions")
    .first();
  assert.notEqual(stored.token_hash, raw);
  assert.match(stored.token_hash, /^[a-f0-9]{64}$/);
  const me = await request("/api/admin/me", "GET", undefined, auth);
  assert.equal(me.status, 200);
  const missingCsrf = await request("/api/admin/songs", "POST", song(), null, {
    Cookie: auth.cookie,
  });
  assert.equal(missingCsrf.status, 403);
  assert.equal(
    (
      await request("/api/admin/songs", "POST", song(), auth, {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/admin/songs", "POST", song(), auth, {
        Origin: "null",
      })
    ).status,
    403,
  );
  const secure = await mf.dispatchFetch(
    "https://example.test/api/admin/login",
    {
      method: "POST",
      headers: {
        Origin: "https://example.test",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.4",
      },
      body: JSON.stringify({ username: "test-admin", password }),
    },
  );
  assert.equal(secure.status, 200);
  assert.match(
    secure.headers.get("Set-Cookie"),
    /HttpOnly; SameSite=Lax; Path=\/; Max-Age=604800; Secure/,
  );
  await secure.arrayBuffer();
});
test("persistent throttle limits concurrent guesses before password verification", async () => {
  const attempts = await Promise.all(
    Array.from({ length: 12 }, () =>
      request("/api/admin/login", "POST", {
        username: "missing",
        password: "bad",
      }),
    ),
  );
  assert.equal(attempts.filter((r) => r.status === 401).length, 10);
  assert.equal(attempts.filter((r) => r.status === 429).length, 2);
  assert.equal(
    attempts.find((r) => r.status === 429).headers.get("Retry-After"),
    "900",
  );
});
test("CRUD persists in D1; proficiency and practice state remain independent; public never leaks memo/private", async () => {
  const auth = await login();
  const created = await create(auth);
  let response = await request(
    `/api/admin/songs/${created.id}`,
    "PATCH",
    { proficiency: 5 },
    auth,
  );
  assert.equal(response.status, 200);
  let updated = await response.json();
  assert.equal(updated.practice_status, "practicing");
  response = await request(
    `/api/admin/songs/${created.id}`,
    "PATCH",
    { practice_status: "completed" },
    auth,
  );
  updated = await response.json();
  assert.equal(updated.proficiency, 5);
  await create(
    auth,
    song({ title: "비공개 테스트", genre: "SECRET_GENRE", is_public: false }),
  );
  const publicList = await (
    await request("/api/songs?include_filters=1")
  ).json();
  assert.equal(publicList.pagination.total, 1);
  assert.equal(publicList.items[0].is_public, true);
  assert.ok(!JSON.stringify(publicList).includes("PRIVATE_TEST_MEMO"));
  assert.ok(!JSON.stringify(publicList).includes("SECRET_GENRE"));
  assert.ok(
    !("memo" in (await (await request(`/api/songs/${created.id}`)).json())),
  );
  const adminList = await (
    await request("/api/admin/songs", "GET", undefined, auth)
  ).json();
  assert.equal(adminList.pagination.total, 2);
  assert.ok("memo" in adminList.items[0]);
  const privateId = adminList.items.find((s) => !s.is_public).id;
  assert.equal((await request(`/api/songs/${privateId}`)).status, 404);
  await request(
    `/api/admin/songs/${created.id}`,
    "PATCH",
    { is_public: false },
    auth,
  );
  assert.equal((await request(`/api/songs/${created.id}`)).status, 404);
  assert.equal(
    (await request(`/api/admin/songs/${created.id}`, "DELETE", undefined, auth))
      .status,
    200,
  );
  assert.equal(
    (await request(`/api/admin/songs/${created.id}`, "DELETE", undefined, auth))
      .status,
    404,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM songs").first()).total,
    1,
  );
});
test("search/filter/sort/pagination combine and SQL/wildcards are treated literally", async () => {
  const auth = await login();
  await create(auth, song({ title: "A테스트", balloon_cost: 30 }));
  await create(auth, song({ title: "B테스트", balloon_cost: 10 }));
  await create(auth, song({ title: "C테스트", proficiency: 5 }));
  const data = await (
    await request(
      "/api/songs?q=테스트&genre=발라드&language=한국어&proficiency=3&practice_status=practicing&sort=balloon_asc&page=2&page_size=1",
    )
  ).json();
  assert.equal(data.pagination.total, 2);
  assert.equal(data.items[0].title, "A테스트");
  for (const term of ["' OR 1=1 --", "%", "_"])
    assert.equal(
      (await (await request("/api/songs?q=" + encodeURIComponent(term))).json())
        .pagination.total,
      0,
    );
  assert.equal((await request("/api/songs?sort=constructor")).status, 400);
  assert.equal((await request("/api/songs?page_size=101")).status, 400);
  assert.equal(
    (await request("/api/songs?q=" + encodeURIComponent("한".repeat(40))))
      .status,
    200,
  );
});
test("server validates malformed bodies, unknown fields and unsafe values", async () => {
  const auth = await login();
  for (const invalid of [
    { balloon_cost: -1 },
    { proficiency: 0 },
    { memo: "x".repeat(3001) },
    { is_public: "true" },
    { arbitrary: 1 },
  ]) {
    assert.equal(
      (await request("/api/admin/songs", "POST", song(invalid), auth)).status,
      422,
    );
  }
  assert.equal(
    (
      await request("/api/admin/songs", "POST", "{", auth, {
        "Content-Type": "application/json",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/admin/songs", "POST", "{}", auth, {
        "Content-Type": "text/plain",
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await request("/api/admin/songs", "POST", " ".repeat(66000), auth, {
        "Content-Type": "application/json",
      })
    ).status,
    413,
  );
});
test("CSV preview reports row errors and duplicates; invalid import writes nothing", async () => {
  const auth = await login();
  await create(auth);
  const csv = stringifyCSV([
    song(),
    song({ title: "잘못된 숫자", proficiency: 8 }),
  ]);
  const headers = { "Content-Type": "text/csv" };
  const preview = await (
    await request("/api/admin/songs/import/preview", "POST", csv, auth, headers)
  ).json();
  assert.equal(preview.can_import, false);
  assert.equal(preview.errors[0].row, 3);
  assert.equal(preview.warnings.length, 1);
  assert.equal(
    (await request("/api/admin/songs/import", "POST", csv, auth, headers))
      .status,
    422,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM songs").first()).total,
    1,
  );
  const valid = stringifyCSV([
    song(),
    song({ description: '쉼표, 따옴표 " 와\n줄바꿈', is_public: false }),
  ]);
  const imported = await (
    await request("/api/admin/songs/import", "POST", valid, auth, headers)
  ).json();
  assert.equal(imported.imported, 2);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM songs").first()).total,
    3,
  );
  const exported = await request(
    "/api/admin/songs/export.csv",
    "GET",
    undefined,
    auth,
  );
  const bytes = new Uint8Array(await exported.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [239, 187, 191]);
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.includes("PRIVATE_TEST_MEMO"));
  assert.ok(text.includes('쉼표, 따옴표 "" 와\n줄바꿈'));
  assert.equal(exported.headers.get("Cache-Control"), "no-store");
});
test("1,000 row import uses chunked SQL and is append-only; file/row/encoding limits enforced", async () => {
  const auth = await login();
  const headers = { "Content-Type": "text/csv" };
  const csv = stringifyCSV(
    Array.from({ length: 1000 }, (_, n) => song({ title: `일괄-${n}` })),
  );
  const result = await request(
    "/api/admin/songs/import",
    "POST",
    csv,
    auth,
    headers,
  );
  assert.equal(result.status, 200, await result.clone().text());
  assert.equal((await result.json()).imported, 1000);
  assert.equal(
    (
      await request(
        "/api/admin/songs/import/preview",
        "POST",
        "x".repeat(1024 * 1024 + 1),
        auth,
        headers,
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await request(
        "/api/admin/songs/import/preview",
        "POST",
        new Uint8Array([255]),
        auth,
        headers,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/admin/songs/import/preview",
        "POST",
        CSV_COLUMNS.join(",") + "\n" + "x\n".repeat(1001),
        auth,
        headers,
      )
    ).status,
    422,
  );
});
test("expired/inactive/revoked sessions fail and logout invalidates token in D1", async () => {
  const auth = await login();
  await db
    .prepare("UPDATE admin_sessions SET expires_at='2000-01-01T00:00:00.000Z'")
    .run();
  assert.equal(
    (await request("/api/admin/me", "GET", undefined, auth)).status,
    401,
  );
  const active = await login();
  await db.prepare("UPDATE admin_users SET is_active=0").run();
  assert.equal(
    (await request("/api/admin/me", "GET", undefined, active)).status,
    401,
  );
  await db.prepare("UPDATE admin_users SET is_active=1").run();
  const logout = await request("/api/admin/logout", "POST", undefined, active);
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("Set-Cookie"), /Max-Age=0/);
  assert.equal(
    (await request("/api/admin/me", "GET", undefined, active)).status,
    401,
  );
});

test("admin registration requires an active session, same origin and valid CSRF", async () => {
  const pass = randomToken();
  const body = {
    username: "qa-protected",
    password: pass,
    password_confirmation: pass,
  };
  const before = await db
    .prepare("SELECT COUNT(*) AS total FROM admin_users")
    .first();
  assert.equal((await request("/api/admin/users", "POST", body)).status, 401);
  const auth = await login();
  assert.equal(
    (
      await request("/api/admin/users", "POST", body, null, {
        Cookie: auth.cookie,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/admin/users", "POST", body, null, {
        Cookie: auth.cookie,
        "X-CSRF-Token": "incorrect",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/admin/users", "POST", body, auth, {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  await db
    .prepare("UPDATE admin_users SET is_active=0 WHERE username=?")
    .bind("test-admin")
    .run();
  try {
    assert.equal(
      (await request("/api/admin/users", "POST", body, auth)).status,
      401,
    );
  } finally {
    await db
      .prepare("UPDATE admin_users SET is_active=1 WHERE username=?")
      .bind("test-admin")
      .run();
  }
  await db
    .prepare("UPDATE admin_sessions SET expires_at='2000-01-01T00:00:00.000Z'")
    .run();
  assert.equal(
    (await request("/api/admin/users", "POST", body, auth)).status,
    401,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM admin_users").first())
      .total,
    before.total,
  );
});

test("registered administrator is hashed, response excludes credentials and account can log in", async () => {
  const auth = await login();
  const pass = randomToken().slice(0, 8);
  const response = await request(
    "/api/admin/users",
    "POST",
    {
      username: "qa-created",
      display_name: "추가 관리자",
      password: pass,
      password_confirmation: pass,
    },
    auth,
  );
  assert.equal(response.status, 201, await response.clone().text());
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const account = await response.json();
  assert.deepEqual(Object.keys(account).sort(), [
    "created_at",
    "display_name",
    "id",
    "username",
  ]);
  assert.equal(account.display_name, "추가 관리자");
  const stored = await db
    .prepare("SELECT * FROM admin_users WHERE username=?")
    .bind("qa-created")
    .first();
  assert.equal(stored.password_iterations, PASSWORD_ITERATIONS);
  assert.notEqual(stored.password_hash, pass);
  assert.equal(
    stored.password_hash,
    await hashPassword(pass, stored.password_salt, PASSWORD_ITERATIONS),
  );
  assert.equal(stored.is_active, 1);
  const loggedIn = await request("/api/admin/login", "POST", {
    username: "qa-created",
    password: pass,
  });
  assert.equal(loggedIn.status, 200);
  const sessionData = await loggedIn.json();
  const newAuth = {
    cookie: loggedIn.headers.get("Set-Cookie").split(";")[0],
    csrfToken: sessionData.csrfToken,
  };
  assert.equal(
    (await request("/api/admin/songs", "GET", undefined, newAuth)).status,
    200,
  );
  const nextPass = randomToken();
  const next = await request(
    "/api/admin/users",
    "POST",
    {
      username: "qa-another",
      display_name: " ",
      password: nextPass,
      password_confirmation: nextPass,
    },
    newAuth,
  );
  assert.equal(next.status, 201);
  assert.equal((await next.json()).display_name, "qa-another");
  const another = await db
    .prepare("SELECT password_salt FROM admin_users WHERE username=?")
    .bind("qa-another")
    .first();
  assert.notEqual(another.password_salt, stored.password_salt);
});

test("admin registration validates all fields without creating invalid accounts", async () => {
  const auth = await login(),
    pass = randomToken();
  const body = {
    username: "qa-validation",
    display_name: "검증",
    password: pass,
    password_confirmation: pass,
  };
  for (const invalid of [
    { username: "ab" },
    { username: "한글" },
    { username: "x".repeat(81) },
    { username: "has space" },
    { password: "x".repeat(7), password_confirmation: "x".repeat(7) },
    { password: "x".repeat(257), password_confirmation: "x".repeat(257) },
    { password_confirmation: randomToken() },
    { display_name: "x".repeat(81) },
    { display_name: 12 },
    { password: null },
    { password_confirmation: null },
    { password_hash: "injected" },
    { is_active: false },
    { id: 1 },
  ]) {
    const response = await request(
      "/api/admin/users",
      "POST",
      { ...body, ...invalid },
      auth,
    );
    assert.equal(response.status, 422);
    const error = await response.text();
    assert.ok(!error.includes(pass));
  }
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM admin_users").first())
      .total,
    1,
  );
});

test("duplicate concurrent administrator registration is atomic and does not overwrite credentials", async () => {
  const auth = await login(),
    pass = randomToken();
  const body = {
    username: "qa-duplicate",
    display_name: "원본",
    password: pass,
    password_confirmation: pass,
  };
  const results = await Promise.all([
    request("/api/admin/users", "POST", body, auth),
    request("/api/admin/users", "POST", body, auth),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const replacement = randomToken();
  const duplicate = await request(
    "/api/admin/users",
    "POST",
    {
      ...body,
      display_name: "덮어쓰기 시도",
      password: replacement,
      password_confirmation: replacement,
    },
    auth,
  );
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error.code, "USERNAME_EXISTS");
  assert.equal(
    (
      await db
        .prepare("SELECT display_name FROM admin_users WHERE username=?")
        .bind(body.username)
        .first()
    ).display_name,
    "원본",
  );
  assert.equal(
    (
      await request("/api/admin/login", "POST", {
        username: body.username,
        password: pass,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) AS total FROM admin_users WHERE username=?")
        .bind(body.username)
        .first()
    ).total,
    1,
  );
});

test("admin directory paginates accounts and never exposes credential fields", async () => {
  assert.equal((await request("/api/admin/users")).status, 401);
  const auth = await login();
  const response = await request(
    "/api/admin/users?page=1&page_size=1",
    "GET",
    undefined,
    auth,
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.pagination.total, 1);
  assert.equal(data.items[0].username, "test-admin");
  assert.equal(data.items[0].must_change_password, false);
  for (const key of [
    "password",
    "password_hash",
    "password_salt",
    "password_iterations",
    "token_hash",
  ])
    assert.ok(!(key in data.items[0]));
  assert.equal(
    (await request("/api/admin/users?page_size=101", "GET", undefined, auth))
      .status,
    400,
  );
});

test("password changes reject invalid values and incorrect current password without altering account", async () => {
  const auth = await login(),
    next = randomToken();
  const body = {
    current_password: password,
    password: next,
    password_confirmation: next,
  };
  const before = await db
    .prepare("SELECT password_hash FROM admin_users WHERE username=?")
    .bind("test-admin")
    .first();
  for (const invalid of [
    { password: "x".repeat(7), password_confirmation: "x".repeat(7) },
    { password_confirmation: randomToken() },
    { password: "qwer1234!@#$", password_confirmation: "qwer1234!@#$" },
    { password, password_confirmation: password },
    { current_password: "" },
    { user_id: 123 },
    { must_change_password: false },
  ])
    assert.equal(
      (
        await request(
          "/api/admin/password",
          "PATCH",
          { ...body, ...invalid },
          auth,
        )
      ).status,
      422,
    );
  const wrong = await request(
    "/api/admin/password",
    "PATCH",
    { ...body, current_password: randomToken() },
    auth,
  );
  assert.equal(wrong.status, 403);
  assert.equal((await wrong.json()).error.code, "CURRENT_PASSWORD_INVALID");
  assert.equal(
    (
      await db
        .prepare("SELECT password_hash FROM admin_users WHERE username=?")
        .bind("test-admin")
        .first()
    ).password_hash,
    before.password_hash,
  );
  assert.equal(
    (await request("/api/admin/me", "GET", undefined, auth)).status,
    200,
  );
  assert.equal(
    (await request("/api/admin/password", "PATCH", body)).status,
    401,
  );
  assert.equal(
    (
      await request("/api/admin/password", "PATCH", body, null, {
        Cookie: auth.cookie,
      })
    ).status,
    403,
  );
});

test("changing own password invalidates every existing session and requires a fresh login", async () => {
  const first = await login(),
    second = await login(),
    next = randomToken().slice(0, 8);
  const changed = await request(
    "/api/admin/password",
    "PATCH",
    { current_password: password, password: next, password_confirmation: next },
    first,
  );
  assert.equal(changed.status, 200);
  assert.match(changed.headers.get("Set-Cookie"), /Max-Age=0/);
  for (const auth of [first, second])
    assert.equal(
      (await request("/api/admin/me", "GET", undefined, auth)).status,
      401,
    );
  assert.equal(
    (
      await request("/api/admin/login", "POST", {
        username: "test-admin",
        password,
      })
    ).status,
    401,
  );
  const fresh = await request("/api/admin/login", "POST", {
    username: "test-admin",
    password: next,
  });
  assert.equal(fresh.status, 200);
  assert.equal((await fresh.json()).user.must_change_password, false);
});

test("password reset enforces authentication, CSRF, origin and target existence", async () => {
  const auth = await login();
  const user = await db
    .prepare("SELECT id, password_hash FROM admin_users WHERE username=?")
    .bind("test-admin")
    .first();
  const path = `/api/admin/users/${user.id}/reset-password`;
  assert.equal((await request(path, "POST")).status, 401);
  assert.equal(
    (await request(path, "POST", undefined, null, { Cookie: auth.cookie }))
      .status,
    403,
  );
  assert.equal(
    (
      await request(path, "POST", undefined, auth, {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/admin/users/99999999/reset-password",
        "POST",
        undefined,
        auth,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT password_hash FROM admin_users WHERE id=?")
        .bind(user.id)
        .first()
    ).password_hash,
    user.password_hash,
  );
});

test("reset revokes target sessions, uses the requested password, and forces change before any admin operation", async () => {
  const auth = await login(),
    pass = randomToken();
  const created = await (
    await request(
      "/api/admin/users",
      "POST",
      {
        username: "qa-reset-target",
        password: pass,
        password_confirmation: pass,
      },
      auth,
    )
  ).json();
  const targetLogin = await request("/api/admin/login", "POST", {
    username: created.username,
    password: pass,
  });
  const targetData = await targetLogin.json();
  const oldAuth = {
    cookie: targetLogin.headers.get("Set-Cookie").split(";")[0],
    csrfToken: targetData.csrfToken,
  };
  const reset = await request(
    `/api/admin/users/${created.id}/reset-password`,
    "POST",
    undefined,
    auth,
  );
  assert.equal(reset.status, 200);
  assert.equal((await reset.json()).logged_out, false);
  assert.equal(
    (await request("/api/admin/me", "GET", undefined, oldAuth)).status,
    401,
  );
  assert.equal(
    (await request("/api/admin/me", "GET", undefined, auth)).status,
    200,
  );
  assert.equal(
    (
      await request("/api/admin/login", "POST", {
        username: created.username,
        password: pass,
      })
    ).status,
    401,
  );
  const initial = "qwer1234!@#$";
  const signedIn = await request("/api/admin/login", "POST", {
    username: created.username,
    password: initial,
  });
  assert.equal(signedIn.status, 200);
  const signedData = await signedIn.json();
  assert.equal(signedData.user.must_change_password, true);
  const resetAuth = {
    cookie: signedIn.headers.get("Set-Cookie").split(";")[0],
    csrfToken: signedData.csrfToken,
  };
  for (const [path, method, body] of [
    ["/api/admin/songs", "GET"],
    ["/api/admin/users", "GET"],
    ["/api/admin/songs/export.csv", "GET"],
    ["/api/admin/songs", "POST", song()],
    ["/api/admin/users", "POST", {}],
    [`/api/admin/users/${created.id}/reset-password`, "POST"],
  ]) {
    const response = await request(path, method, body, resetAuth);
    assert.equal(response.status, 403);
    assert.equal(
      (await response.json()).error.code,
      "PASSWORD_CHANGE_REQUIRED",
    );
  }
  assert.equal(
    (await request("/api/admin/me", "GET", undefined, resetAuth)).status,
    200,
  );
  const next = randomToken();
  assert.equal(
    (
      await request(
        "/api/admin/password",
        "PATCH",
        {
          current_password: initial,
          password: next,
          password_confirmation: next,
        },
        resetAuth,
      )
    ).status,
    200,
  );
  const fresh = await request("/api/admin/login", "POST", {
    username: created.username,
    password: next,
  });
  assert.equal(fresh.status, 200);
  assert.equal((await fresh.json()).user.must_change_password, false);
});

test("self reset logs out current admin and rejects reuse of its old session", async () => {
  const auth = await login();
  const me = await (
    await request("/api/admin/me", "GET", undefined, auth)
  ).json();
  const reset = await request(
    `/api/admin/users/${me.user.id}/reset-password`,
    "POST",
    undefined,
    auth,
  );
  assert.equal(reset.status, 200);
  assert.equal((await reset.json()).logged_out, true);
  assert.match(reset.headers.get("Set-Cookie"), /Max-Age=0/);
  assert.equal(
    (await request("/api/admin/me", "GET", undefined, auth)).status,
    401,
  );
  const signed = await request("/api/admin/login", "POST", {
    username: "test-admin",
    password: "qwer1234!@#$",
  });
  assert.equal(signed.status, 200);
  assert.equal((await signed.json()).user.must_change_password, true);
});

test("current-password guessing is persistently rate limited for an authenticated account", async () => {
  const auth = await login(),
    next = randomToken();
  const statuses = [];
  for (let n = 0; n < 11; n++)
    statuses.push(
      (
        await request(
          "/api/admin/password",
          "PATCH",
          {
            current_password: randomToken(),
            password: next,
            password_confirmation: next,
          },
          auth,
        )
      ).status,
    );
  assert.deepEqual(statuses, [...Array(10).fill(403), 429]);
});

test("a legacy account using the initialization password must also change it after login", async () => {
  const initial = "qwer1234!@#$",
    salt = randomToken();
  await db
    .prepare(
      "UPDATE admin_users SET password_hash=?, password_salt=?, must_change_password=0 WHERE username=?",
    )
    .bind(await hashPassword(initial, salt), salt, "test-admin")
    .run();
  const response = await request("/api/admin/login", "POST", {
    username: "test-admin",
    password: initial,
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.must_change_password, true);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT must_change_password FROM admin_users WHERE username=?",
        )
        .bind("test-admin")
        .first()
    ).must_change_password,
    1,
  );
});
