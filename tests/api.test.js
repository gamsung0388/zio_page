import { defaultNavigation } from "../shared/navigation.js";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare, createFetchMock } from "miniflare";
import {
  hashPassword,
  randomToken,
  PASSWORD_ITERATIONS,
} from "../server/utils/crypto.js";
import { stringifyCSV, CSV_COLUMNS } from "../server/services/csv.js";

let mf, db, password, originalAdmin, upstreamMock;
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
async function csvImport(auth, text, options = {}) {
  const preview =
    options.preview ||
    (await (
      await request("/api/admin/songs/import/preview", "POST", text, auth, {
        "Content-Type": "text/csv",
      })
    ).json());
  return request("/api/admin/songs/import", "POST", text, auth, {
    "Content-Type": "text/csv",
    "Idempotency-Key": options.key || randomToken(),
    "X-CSV-Preview": preview.preview_token,
    "X-CSV-Duplicates": options.confirmed ?? "yes",
  });
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
  upstreamMock = createFetchMock();
  upstreamMock.disableNetConnect();
  mf = new Miniflare({
    fetchMock: upstreamMock,
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
    "0004_admin_schedule_weeks.sql",
    "0005_admin_schedule_events.sql",
    "0006_song_revisions.sql",
    "0007_site_navigation.sql",
    "0008_song_import_jobs.sql",
    "0009_song_albums.sql",
    "0010_operation_recovery.sql",
    "0011_song_cover_images.sql",
  ]) {
    const sql = await readFile(`migrations/${file}`, "utf8");
    for (const statement of sql
      .replace(/^--.*$/gm, "")
      .split(/;[ \t]*(?:\r?\n|$)/)
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
      "DELETE FROM catalog_cache",
      "DELETE FROM catalog_limits",
      "DELETE FROM song_import_jobs",
      "DELETE FROM site_navigation",
      "DELETE FROM site_settings",
      "DELETE FROM admin_schedule_events",
      "DELETE FROM admin_schedule_weeks",
      "DELETE FROM songs",
      "DELETE FROM admin_sessions",
      "DELETE FROM login_limits",
      "DELETE FROM admin_users WHERE username <> 'test-admin'",
      "DELETE FROM operation_history",
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
    ["GET", "/songs/1"],
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
    { proficiency: 5, expected_revision: 1 },
    auth,
  );
  assert.equal(response.status, 200);
  let updated = await response.json();
  assert.equal(updated.practice_status, "practicing");
  response = await request(
    `/api/admin/songs/${created.id}`,
    "PATCH",
    { practice_status: "completed", expected_revision: 2 },
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
    { is_public: false, expected_revision: 3 },
    auth,
  );
  assert.equal((await request(`/api/songs/${created.id}`)).status, 404);
  assert.equal(
    (
      await request(
        `/api/admin/songs/${created.id}`,
        "DELETE",
        { expected_revision: 4 },
        auth,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/api/admin/songs/${created.id}`,
        "DELETE",
        { expected_revision: 4 },
        auth,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) AS total FROM songs WHERE deleted_at IS NULL")
        .first()
    ).total,
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
      await request("/api/admin/songs", "POST", " ".repeat(132000), auth, {
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
  assert.equal((await csvImport(auth, csv)).status, 422);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM songs").first()).total,
    1,
  );
  const valid = stringifyCSV([
    song(),
    song({ description: '쉼표, 따옴표 " 와\n줄바꿈', is_public: false }),
  ]);
  const imported = await (await csvImport(auth, valid)).json();
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
  const result = await csvImport(auth, csv);
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

test("admin editor can reload a private song with memo while public API cannot reveal it", async () => {
  const auth = await login();
  const saved = await create(auth, song({ is_public: false }));
  const response = await request(
    "/api/admin/songs/" + saved.id,
    "GET",
    undefined,
    auth,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).memo, "PRIVATE_TEST_MEMO");
  assert.equal((await request("/api/songs/" + saved.id)).status, 404);
  assert.equal((await request("/api/admin/songs/" + saved.id)).status, 401);
  assert.equal(
    (await request("/api/admin/songs/999999", "GET", undefined, auth)).status,
    404,
  );
});

const schedulePayload = (extra = {}) => ({
  expected_revision: 0,
  selectedTemplate: "images/schedule/zio-schedule-template.png",
  scheduleForm: Object.fromEntries(
    ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((key) => [
      key,
      { content: "", time: "" },
    ]),
  ),
  editorOptions: {
    contentFontSize: 25,
    timeFontSize: 25,
    textColor: "#1f3f18",
    bold: true,
    align: "left",
    hideColon: false,
  },
  ...extra,
});
test("private schedule API requires authentication, Origin, CSRF and changed passwords", async () => {
  for (const [path, method] of [
    ["/api/admin/schedules?from=2026-10-01&to=2026-10-31", "GET"],
    ["/api/admin/schedules/2026-10-12", "GET"],
    ["/api/admin/schedules/2026-10-12", "PUT"],
  ])
    assert.equal(
      (
        await request(
          path,
          method,
          method === "PUT" ? schedulePayload() : undefined,
        )
      ).status,
      401,
    );
  assert.equal((await request("/api/schedules")).status, 404);
  const auth = await login();
  assert.equal(
    (
      await request(
        "/api/admin/schedules/2026-10-12",
        "PUT",
        schedulePayload(),
        { ...auth, csrfToken: "" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/admin/schedules/2026-10-12",
        "PUT",
        schedulePayload(),
        auth,
        { Origin: "https://elsewhere.invalid" },
      )
    ).status,
    403,
  );
  await db.prepare("UPDATE admin_users SET must_change_password=1").run();
  for (const method of ["GET", "PUT"]) {
    const response = await request(
      "/api/admin/schedules/2026-10-12",
      method,
      method === "PUT" ? schedulePayload() : undefined,
      auth,
    );
    assert.equal(response.status, 403);
    assert.equal(
      (await response.json()).error.code,
      "PASSWORD_CHANGE_REQUIRED",
    );
  }
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM admin_schedule_weeks").first()).n,
    0,
  );
});
test("weekly schedules persist once, keep multiline/Korean data and share the calendar range", async () => {
  const auth = await login(),
    path = "/api/admin/schedules/2026-10-12";
  const empty = await request(path, "GET", undefined, auth);
  assert.equal(empty.status, 200);
  assert.equal((await empty.json()).revision, 0);
  assert.equal(empty.headers.get("Cache-Control"), "no-store");
  const payload = schedulePayload();
  payload.scheduleForm.mon = {
    content: "노래 방송 🎵\n함께해요",
    time: "20:30",
  };
  payload.scheduleForm.tue = { content: "휴방", time: "" };
  assert.equal((await request(path, "PUT", payload, auth)).status, 201);
  const saved = await (await request(path, "GET", undefined, auth)).json();
  assert.equal(saved.revision, 1);
  assert.deepEqual(saved.scheduleForm, payload.scheduleForm);
  const list = await (
    await request(
      "/api/admin/schedules?from=2026-10-01&to=2026-10-31",
      "GET",
      undefined,
      auth,
    )
  ).json();
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].week_start, "2026-10-12");
  assert.equal("updated_by" in list.items[0], false);
  const update = { ...payload, expected_revision: 1 };
  update.scheduleForm.mon = { content: "", time: "" };
  const changed = await request(path, "PUT", update, auth);
  assert.equal(changed.status, 200);
  const data = await changed.json();
  assert.equal(data.revision, 2);
  assert.equal(data.scheduleForm.tue.content, "휴방");
});
test("schedule revision checks reject concurrent creation and edits without losing saved content", async () => {
  const auth = await login(),
    path = "/api/admin/schedules/2026-10-12";
  const results = await Promise.all([
    request(path, "PUT", schedulePayload(), auth),
    request(path, "PUT", schedulePayload(), auth),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const a = schedulePayload({ expected_revision: 1 }),
    b = schedulePayload({ expected_revision: 1 });
  a.scheduleForm.mon.content = "먼저 A";
  b.scheduleForm.mon.content = "먼저 B";
  const updated = await Promise.all([
    request(path, "PUT", a, auth),
    request(path, "PUT", b, auth),
  ]);
  assert.deepEqual(updated.map((r) => r.status).sort(), [200, 409]);
  const saved = await (await request(path, "GET", undefined, auth)).json();
  assert.equal(saved.revision, 2);
  assert.ok(["먼저 A", "먼저 B"].includes(saved.scheduleForm.mon.content));
  assert.equal(
    (
      await request(
        "/api/admin/schedules/2026-10-19",
        "PUT",
        schedulePayload({ expected_revision: 9 }),
        auth,
      )
    ).status,
    409,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM admin_schedule_weeks").first()).n,
    1,
  );
});
test("schedule validation bounds ranges, template URLs, text, option values and unknown keys", async () => {
  const auth = await login(),
    path = "/api/admin/schedules/2026-10-12";
  for (const query of [
    "",
    "from=2026-02-30&to=2026-03-01",
    "from=2026-01-01&to=2026-12-31",
    "from=2026-10-31&to=2026-10-01",
    "from=2026-10-01&to=2026-10-31&sql=bad",
  ])
    assert.equal(
      (await request("/api/admin/schedules?" + query, "GET", undefined, auth))
        .status,
      400,
    );
  for (const date of ["2026-10-13", "2026-02-30"])
    assert.equal(
      (await request("/api/admin/schedules/" + date, "GET", undefined, auth))
        .status,
      400,
    );
  const cases = [
    { selectedTemplate: "https://external.invalid/image.png" },
    { expected_revision: -1 },
    { expected_revision: 1.5 },
    { extra: true },
    { editorOptions: { ...schedulePayload().editorOptions, textColor: "red" } },
    {
      editorOptions: {
        ...schedulePayload().editorOptions,
        contentFontSize: 99,
      },
    },
    {
      editorOptions: { ...schedulePayload().editorOptions, align: "__proto__" },
    },
  ];
  for (const extra of cases)
    assert.equal(
      (await request(path, "PUT", schedulePayload(extra), auth)).status,
      422,
    );
  for (const [field, value] of [
    ["content", "x".repeat(501)],
    ["time", 42],
    ["time", "x".repeat(41)],
  ]) {
    const payload = schedulePayload();
    payload.scheduleForm.mon[field] = value;
    assert.equal((await request(path, "PUT", payload, auth)).status, 422);
  }
  const pollution = schedulePayload();
  pollution.scheduleForm.mon.extra = "ignored?";
  assert.equal((await request(path, "PUT", pollution, auth)).status, 422);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM admin_schedule_weeks").first()).n,
    0,
  );
});

test("successful logins release their own rate reservations while failed guesses remain limited", async () => {
  for (let index = 0; index < 12; index++) await login();
  const counts = await db.prepare("SELECT attempts FROM login_limits").all();
  assert.ok(counts.results.every((row) => row.attempts === 0));
  for (let index = 0; index < 10; index++)
    assert.equal(
      (
        await request("/api/admin/login", "POST", {
          username: "test-admin",
          password: "wrong-password",
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await request("/api/admin/login", "POST", {
        username: "test-admin",
        password,
      })
    ).status,
    429,
  );
});
test("full schedule backup is authenticated, ordered, paginated and never exposes actor data", async () => {
  assert.equal((await request("/api/admin/schedules/backup")).status, 401);
  const auth = await login();
  const { createScheduleForm, createEditorOptions } =
    await import("../shared/schedule/scheduleFactory.js");
  const { DEFAULT_TEMPLATE } =
    await import("../shared/schedule/scheduleConfig.js");
  const { addDays } = await import("../shared/schedule/dates.js");
  const payload = JSON.stringify({
    selectedTemplate: DEFAULT_TEMPLATE,
    scheduleForm: createScheduleForm(),
    editorOptions: createEditorOptions(),
  });
  await db.batch(
    Array.from({ length: 53 }, (_, index) =>
      db
        .prepare(
          "INSERT INTO admin_schedule_weeks (week_start,payload,updated_by) VALUES (?,?,1)",
        )
        .bind(addDays("2027-01-04", index * 7), payload),
    ),
  );
  const first = await (
    await request("/api/admin/schedules/backup", "GET", null, auth)
  ).json();
  assert.equal(first.items.length, 50);
  assert.equal(first.next_after, addDays("2027-01-04", 49 * 7));
  assert.ok(first.items.every((item) => !Object.hasOwn(item, "updated_by")));
  const second = await (
    await request(
      "/api/admin/schedules/backup?after=" + first.next_after,
      "GET",
      null,
      auth,
    )
  ).json();
  assert.equal(second.items.length, 3);
  assert.equal(second.next_after, null);
  assert.equal(
    new Set([...first.items, ...second.items].map((item) => item.week_start))
      .size,
    53,
  );
  for (const query of [
    "?after=2027-01-05",
    "?after=",
    "?extra=1",
    "?after=2027-01-04&after=2027-01-11",
  ])
    assert.equal(
      (await request("/api/admin/schedules/backup" + query, "GET", null, auth))
        .status,
      400,
    );
});

const eventPayload = (extra = {}) => ({
  title: "노래 방송",
  description: "방송 안내",
  kind: "broadcast",
  time_mode: "timed",
  start_date: "2027-01-04",
  end_date: "2027-01-04",
  start_time: "20:30",
  end_time: "22:00",
  ...extra,
});
async function createScheduleEvent(auth, extra = {}) {
  const response = await request(
    "/api/admin/schedule-events",
    "POST",
    eventPayload(extra),
    auth,
  );
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
}
test("individual events share session, forced-password, same-origin and CSRF protection", async () => {
  for (const [path, method, body] of [
    ["/api/admin/schedule-events?from=2027-01-01&to=2027-01-31", "GET"],
    ["/api/admin/schedule-events/1", "GET"],
    ["/api/admin/schedule-events/backup", "GET"],
    ["/api/admin/schedule-events", "POST", eventPayload()],
    [
      "/api/admin/schedule-events/1",
      "PUT",
      { ...eventPayload(), expected_revision: 1 },
    ],
    ["/api/admin/schedule-events/1", "DELETE", { expected_revision: 1 }],
  ])
    assert.equal((await request(path, method, body)).status, 401);
  const auth = await login();
  assert.equal(
    (
      await request("/api/admin/schedule-events", "POST", eventPayload(), {
        ...auth,
        csrfToken: "",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/admin/schedule-events",
        "POST",
        eventPayload(),
        auth,
        { Origin: "https://other.test" },
      )
    ).status,
    403,
  );
  await db.prepare("UPDATE admin_users SET must_change_password=1").run();
  for (const [path, method, body] of [
    ["/api/admin/schedule-events?from=2027-01-01&to=2027-01-31", "GET"],
    ["/api/admin/schedule-events/backup", "GET"],
    ["/api/admin/schedule-events", "POST", eventPayload()],
  ])
    assert.equal((await request(path, method, body, auth)).status, 403);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM admin_schedule_events").first())
      .n,
    0,
  );
});
test("multiple events on one date persist their KST times independently of weekly image notes", async () => {
  const auth = await login(),
    week = schedulePayload();
  week.scheduleForm.mon = { content: "기존 이미지 메모", time: "미정" };
  await request("/api/admin/schedules/2027-01-04", "PUT", week, auth);
  const first = await createScheduleEvent(auth),
    second = await createScheduleEvent(auth, {
      title: "게임 합방",
      kind: "collab",
      start_time: "22:00",
      end_time: "23:00",
    });
  assert.notEqual(first.id, second.id);
  assert.equal(first.starts_at, "2027-01-04T11:30:00.000Z");
  assert.equal(first.ends_at, "2027-01-04T13:00:00.000Z");
  assert.equal(first.start_time, "20:30");
  const response = await request(
      "/api/admin/schedule-events?from=2027-01-04&to=2027-01-04",
      "GET",
      null,
      auth,
    ),
    data = await response.json();
  assert.equal(data.items.length, 2);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal("updated_by" in data.items[0], false);
  const filtered = await (
    await request(
      "/api/admin/schedule-events?from=2027-01-01&to=2027-01-31&kind=collab&page_size=1",
      "GET",
      null,
      auth,
    )
  ).json();
  assert.equal(filtered.pagination.total, 1);
  assert.equal(filtered.items[0].title, "게임 합방");
  const row = await (
    await request("/api/admin/schedules/2027-01-04", "GET", null, auth)
  ).json();
  assert.deepEqual(row.scheduleForm.mon, week.scheduleForm.mon);
  assert.equal((await request("/api/schedule-events")).status, 404);
});
test("event overlap uses exclusive timed end and inclusive all-day end across weeks and midnight", async () => {
  const auth = await login();
  await createScheduleEvent(auth, {
    start_date: "2027-01-03",
    end_date: "2027-01-04",
    start_time: "23:00",
    end_time: "00:00",
    title: "자정 종료",
  });
  await createScheduleEvent(auth, {
    start_date: "2027-01-04",
    end_date: "2027-01-06",
    time_mode: "all_day",
    start_time: "",
    end_time: "",
    title: "여러 날 종일",
  });
  await createScheduleEvent(auth, {
    start_date: "2027-01-06",
    end_date: "2027-01-08",
    time_mode: "undecided",
    start_time: "",
    end_time: "",
    title: "시간 미정 기간",
  });
  const at = async (day) =>
    (
      await (
        await request(
          "/api/admin/schedule-events?from=" + day + "&to=" + day,
          "GET",
          null,
          auth,
        )
      ).json()
    ).items.map((item) => item.title);
  assert.deepEqual(await at("2027-01-03"), ["자정 종료"]);
  assert.deepEqual(await at("2027-01-04"), ["여러 날 종일"]);
  assert.deepEqual(await at("2027-01-06"), ["여러 날 종일", "시간 미정 기간"]);
  assert.deepEqual(await at("2027-01-08"), ["시간 미정 기간"]);
  assert.deepEqual(await at("2027-01-09"), []);
});
test("event versions atomically protect updates and deletes of one item without touching others", async () => {
  const auth = await login(),
    first = await createScheduleEvent(auth),
    other = await createScheduleEvent(auth, { title: "다른 일정" }),
    path = "/api/admin/schedule-events/" + first.id;
  const updates = await Promise.all([
    request(
      path,
      "PUT",
      { ...eventPayload({ title: "변경 A" }), expected_revision: 1 },
      auth,
    ),
    request(
      path,
      "PUT",
      { ...eventPayload({ title: "변경 B" }), expected_revision: 1 },
      auth,
    ),
  ]);
  assert.deepEqual(updates.map((item) => item.status).sort(), [200, 409]);
  const saved = await (await request(path, "GET", null, auth)).json();
  assert.equal(saved.revision, 2);
  assert.equal(
    (await request(path, "DELETE", { expected_revision: 1 }, auth)).status,
    409,
  );
  assert.equal(
    (await request(path, "DELETE", { expected_revision: 2 }, auth)).status,
    200,
  );
  assert.equal((await request(path, "GET", null, auth)).status, 404);
  assert.equal(
    (await request("/api/admin/schedule-events/" + other.id, "GET", null, auth))
      .status,
    200,
  );
});
test("event validation rejects invalid clocks, dates, periods, types, unknown fields and query parameters", async () => {
  const auth = await login();
  for (const extra of [
    { title: "" },
    { title: "x".repeat(121) },
    { description: "x".repeat(2001) },
    { kind: "__proto__" },
    { time_mode: "daily" },
    { start_date: "2027-02-29" },
    { start_date: "1999-12-31" },
    { end_date: "2100-01-01" },
    { end_date: "2027-01-03" },
    { start_time: "24:00" },
    { start_time: "20:30:00" },
    { start_time: 20 },
    { end_time: "20:30" },
    { end_time: "19:00" },
    { time_mode: "all_day" },
    { end_date: "2028-01-05" },
    { extra: true },
  ])
    assert.equal(
      (
        await request(
          "/api/admin/schedule-events",
          "POST",
          eventPayload(extra),
          auth,
        )
      ).status,
      422,
      JSON.stringify(extra),
    );
  for (const value of [[], null, "text"])
    assert.equal(
      (
        await request(
          "/api/admin/schedule-events",
          "POST",
          value === null ? "null" : JSON.stringify(value),
          auth,
          { "Content-Type": "application/json" },
        )
      ).status,
      400,
    );
  for (const query of [
    "",
    "from=2027-01-01&to=2027-12-31",
    "from=2027-01-02&to=2027-01-01",
    "from=2027-01-01&to=2027-01-31&kind=bad",
    "from=2027-01-01&to=2027-01-31&page=0",
    "from=2027-01-01&to=2027-01-31&page_size=201",
    "from=2027-01-01&from=2027-01-02&to=2027-01-31",
    "from=2027-01-01&to=2027-01-31&extra=1",
  ])
    assert.equal(
      (await request("/api/admin/schedule-events?" + query, "GET", null, auth))
        .status,
      400,
    );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM admin_schedule_events").first())
      .n,
    0,
  );
  const leap = await createScheduleEvent(auth, {
    title: "🐼".repeat(120),
    start_date: "2024-02-29",
    end_date: "2024-02-29",
  });
  assert.equal(leap.start_date, "2024-02-29");
});
test("event backup pages by id without gaps and never includes actor or authentication fields", async () => {
  const auth = await login();
  await db
    .prepare(
      "INSERT INTO admin_schedule_events (title,description,kind,time_mode,starts_at,ends_at) SELECT '일정 '||key,'','broadcast','timed',?,? FROM json_each(?)",
    )
    .bind(
      "2027-01-04T11:00:00.000Z",
      "2027-01-04T12:00:00.000Z",
      JSON.stringify(Array(203).fill(0)),
    )
    .run();
  const first = await (
    await request("/api/admin/schedule-events/backup", "GET", null, auth)
  ).json();
  assert.equal(first.items.length, 200);
  assert.equal(first.next_after, first.items.at(-1).id);
  const second = await (
    await request(
      "/api/admin/schedule-events/backup?after=" + first.next_after,
      "GET",
      null,
      auth,
    )
  ).json();
  assert.equal(second.items.length, 3);
  assert.equal(second.next_after, null);
  assert.equal(
    new Set([...first.items, ...second.items].map((item) => item.id)).size,
    203,
  );
  assert.ok(
    first.items.every(
      (item) => !("updated_by" in item) && !("csrfToken" in item),
    ),
  );
  for (const query of [
    "?after=0",
    "?after=1&after=2",
    "?extra=1",
    "?after=9007199254740992",
  ])
    assert.equal(
      (
        await request(
          "/api/admin/schedule-events/backup" + query,
          "GET",
          null,
          auth,
        )
      ).status,
      400,
    );
});

test("weekly memo deletion requires authentication, CSRF, same origin and a changed password", async () => {
  const path = "/api/admin/schedules/2026-10-12",
    body = { expected_revision: 1 };
  assert.equal((await request(path, "DELETE", body)).status, 401);
  const auth = await login();
  assert.equal(
    (await request(path, "PUT", schedulePayload(), auth)).status,
    201,
  );
  assert.equal(
    (await request(path, "DELETE", body, { ...auth, csrfToken: "" })).status,
    403,
  );
  assert.equal(
    (
      await request(path, "DELETE", body, auth, {
        Origin: "https://elsewhere.invalid",
      })
    ).status,
    403,
  );
  await db.prepare("UPDATE admin_users SET must_change_password=1").run();
  assert.equal((await request(path, "DELETE", body, auth)).status, 403);
  const row = await db
    .prepare(
      "SELECT revision,payload FROM admin_schedule_weeks WHERE week_start=?",
    )
    .bind("2026-10-12")
    .first();
  assert.equal(row.revision, 1);
  assert.equal(JSON.parse(row.payload)._deleted, undefined);
});

test("weekly deletion erases all seven days and style, hides backup entries and preserves other weeks and individual events", async () => {
  const auth = await login(),
    path = "/api/admin/schedules/2026-10-12";
  const payload = schedulePayload({
    selectedTemplate: "images/schedule/zio-schedule-template2.png",
  });
  for (const day of Object.values(payload.scheduleForm)) {
    day.content = "ERASE_THIS_WEEK";
    day.time = "20:00";
  }
  await request(path, "PUT", payload, auth);
  await request(
    "/api/admin/schedules/2026-10-19",
    "PUT",
    schedulePayload(),
    auth,
  );
  const event = await (
    await request("/api/admin/schedule-events", "POST", eventPayload(), auth)
  ).json();
  const response = await request(
    path,
    "DELETE",
    { expected_revision: 1 },
    auth,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const empty = await response.json();
  assert.equal(empty.is_saved, false);
  assert.equal(empty.revision, 2);
  assert.equal(empty.updated_at, null);
  assert.equal(empty.selectedTemplate, schedulePayload().selectedTemplate);
  for (const entry of Object.values(empty.scheduleForm))
    assert.deepEqual(entry, { content: "", time: "" });
  assert.deepEqual(
    await (await request(path, "GET", undefined, auth)).json(),
    empty,
  );
  const list = await (
    await request(
      "/api/admin/schedules?from=2026-10-01&to=2026-10-31",
      "GET",
      undefined,
      auth,
    )
  ).json();
  assert.deepEqual(
    list.items.map((item) => item.week_start),
    ["2026-10-19"],
  );
  const backup = await (
    await request("/api/admin/schedules/backup", "GET", undefined, auth)
  ).json();
  assert.deepEqual(
    backup.items.map((item) => item.week_start),
    ["2026-10-19"],
  );
  const stored = await db
    .prepare("SELECT payload FROM admin_schedule_weeks WHERE week_start=?")
    .bind("2026-10-12")
    .first();
  assert.equal(stored.payload.includes("ERASE_THIS_WEEK"), false);
  assert.deepEqual(JSON.parse(stored.payload), { _deleted: true });
  assert.equal(
    (
      await request(
        "/api/admin/schedule-events/" + event.id,
        "GET",
        undefined,
        auth,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/admin/schedules/2026-10-19", "GET", undefined, auth))
      .status,
    200,
  );
  assert.equal("updated_by" in empty, false);
});

test("weekly deletion is atomic and old editors cannot modify or delete a recreated memo", async () => {
  const auth = await login(),
    path = "/api/admin/schedules/2026-10-12";
  await request(path, "PUT", schedulePayload(), auth);
  const results = await Promise.all([
    request(path, "DELETE", { expected_revision: 1 }, auth),
    request(path, "DELETE", { expected_revision: 1 }, auth),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal(
    (
      await request(
        path,
        "PUT",
        schedulePayload({ expected_revision: 1 }),
        auth,
      )
    ).status,
    409,
  );
  assert.equal(
    (await request(path, "PUT", schedulePayload(), auth)).status,
    409,
  );
  const tombstone = await (await request(path, "GET", undefined, auth)).json();
  const restore = schedulePayload({ expected_revision: tombstone.revision });
  restore.scheduleForm.mon.content = "NEWER_WEEK";
  const recreated = await request(path, "PUT", restore, auth);
  assert.equal(recreated.status, 200);
  const latest = await recreated.json();
  assert.equal(latest.revision, 3);
  assert.equal(latest.is_saved, true);
  assert.equal(
    (await request(path, "DELETE", { expected_revision: 1 }, auth)).status,
    409,
  );
  assert.equal(
    (await request(path, "DELETE", { expected_revision: 2 }, auth)).status,
    409,
  );
  assert.equal(
    (
      await request(
        path,
        "PUT",
        schedulePayload({ expected_revision: 1 }),
        auth,
      )
    ).status,
    409,
  );
  assert.equal(
    (await (await request(path, "GET", undefined, auth)).json()).scheduleForm
      .mon.content,
    "NEWER_WEEK",
  );
});

test("weekly deletion rejects unknown fields, invalid revisions and invalid weeks without erasing content", async () => {
  const auth = await login(),
    path = "/api/admin/schedules/2026-10-12";
  await request(path, "PUT", schedulePayload(), auth);
  for (const body of [
    {},
    { expected_revision: 0 },
    { expected_revision: -1 },
    { expected_revision: 1.5 },
    { expected_revision: "1" },
    { expected_revision: Number.MAX_SAFE_INTEGER + 1 },
    { expected_revision: 1, delete_all: true },
  ])
    assert.equal((await request(path, "DELETE", body, auth)).status, 422);
  for (const date of ["2026-10-13", "2026-02-30"])
    assert.equal(
      (
        await request(
          "/api/admin/schedules/" + date,
          "DELETE",
          { expected_revision: 1 },
          auth,
        )
      ).status,
      400,
    );
  assert.equal(
    (
      await request(
        "/api/admin/schedules/2026-10-19",
        "DELETE",
        { expected_revision: 1 },
        auth,
      )
    ).status,
    409,
  );
  assert.equal(
    (await (await request(path, "GET", undefined, auth)).json()).is_saved,
    true,
  );
});

test("song versions protect concurrent edits, stale visibility changes and deletes atomically", async () => {
  const firstAuth = await login(),
    secondAuth = await login();
  const created = await create(firstAuth),
    path = "/api/admin/songs/" + created.id;
  assert.equal(created.revision, 1);
  const updates = await Promise.all([
    request(
      path,
      "PATCH",
      { title: "편집 A", expected_revision: 1 },
      firstAuth,
    ),
    request(
      path,
      "PATCH",
      { title: "편집 B", expected_revision: 1 },
      secondAuth,
    ),
  ]);
  assert.deepEqual(updates.map((item) => item.status).sort(), [200, 409]);
  assert.equal(
    (await updates.find((item) => item.status === 409).json()).error.code,
    "SONG_CONFLICT",
  );
  const saved = await (await request(path, "GET", undefined, firstAuth)).json();
  assert.equal(saved.revision, 2);
  assert.equal(
    (
      await request(
        path,
        "PATCH",
        { is_public: false, expected_revision: 1 },
        secondAuth,
      )
    ).status,
    409,
  );
  assert.equal(
    (await request(path, "DELETE", { expected_revision: 1 }, secondAuth))
      .status,
    409,
  );
  assert.equal(
    (await request(path, "DELETE", { expected_revision: 2 }, firstAuth)).status,
    200,
  );
  assert.equal(
    (
      await request(
        path,
        "PATCH",
        { title: "삭제 후 저장", expected_revision: 2 },
        secondAuth,
      )
    ).status,
    409,
  );
  assert.equal((await request(path, "GET", undefined, firstAuth)).status, 404);
});
test("song mutations require strict revisions while public API and CSV keep their existing field contracts", async () => {
  const auth = await login(),
    created = await create(auth),
    path = "/api/admin/songs/" + created.id;
  for (const expected_revision of [
    undefined,
    0,
    -1,
    1.5,
    "1",
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.equal(
      (await request(path, "PATCH", { title: "변경", expected_revision }, auth))
        .status,
      422,
    );
    assert.equal(
      (await request(path, "DELETE", { expected_revision }, auth)).status,
      422,
    );
  }
  assert.equal(
    (await request(path, "DELETE", { expected_revision: 1, extra: true }, auth))
      .status,
    422,
  );
  const publicSong = await (await request("/api/songs/" + created.id)).json();
  assert.equal("revision" in publicSong, false);
  assert.equal("memo" in publicSong, false);
  const publicList = await (await request("/api/songs")).json();
  assert.equal("revision" in publicList.items[0], false);
  const backup = await (
    await request("/api/admin/songs/export.csv", "GET", undefined, auth)
  ).text();
  assert.equal(
    backup.replace(/^\uFEFF/, "").split("\r\n")[0],
    CSV_COLUMNS.join(","),
  );
  assert.equal(backup.includes("revision"), false);
  assert.equal((await request(path, "GET", undefined, auth)).status, 200);
  assert.equal(
    (await (await request(path, "GET", undefined, auth)).json()).revision,
    1,
  );
});
test("event list API pages beyond 2000 records and uses overlap rather than start-date equality", async () => {
  const auth = await login();
  await db
    .prepare(
      "INSERT INTO admin_schedule_events (title,description,kind,time_mode,starts_at,ends_at) SELECT '대량 '||key,'','broadcast','all_day',?,? FROM json_each(?)",
    )
    .bind(
      "2028-01-31T15:00:00.000Z",
      "2028-03-01T15:00:00.000Z",
      JSON.stringify(Array(2051).fill(0)),
    )
    .run();
  const data = await (
    await request(
      "/api/admin/schedule-events?from=2028-02-15&to=2028-02-15&page=42&page_size=50",
      "GET",
      undefined,
      auth,
    )
  ).json();
  assert.equal(data.pagination.total, 2051);
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].start_date, "2028-02-01");
  assert.equal(data.items[0].end_date, "2028-03-01");
  const filtered = await (
    await request(
      "/api/admin/schedule-events?from=2028-02-15&to=2028-02-15&kind=personal&page=1&page_size=50",
      "GET",
      undefined,
      auth,
    )
  ).json();
  assert.equal(filtered.pagination.total, 0);
});

test("navigation settings enforce administrator authentication, CSRF, origin and forced password change", async () => {
  const path = "/api/admin/navigation",
    payload = { items: defaultNavigation(), expected_revision: 0 };
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, "PUT", payload)).status, 401);
  const auth = await login();
  assert.equal(
    (await request(path, "PUT", payload, { ...auth, csrfToken: "" })).status,
    403,
  );
  assert.equal(
    (
      await request(path, "PUT", payload, auth, {
        Origin: "https://elsewhere.invalid",
      })
    ).status,
    403,
  );
  await db.prepare("UPDATE admin_users SET must_change_password=1").run();
  assert.equal((await request(path, "GET", undefined, auth)).status, 403);
  assert.equal((await request(path, "PUT", payload, auth)).status, 403);
  assert.equal((await request("/api/navigation")).status, 200);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM site_navigation").first()).n,
    0,
  );
});
test("saved navigation is shared but public responses omit hidden and administrator links and actor fields", async () => {
  const auth = await login();
  const initial = await (
    await request("/api/admin/navigation", "GET", undefined, auth)
  ).json();
  assert.equal(initial.revision, 0);
  const items = defaultNavigation().map((item) =>
    ["about", "manage"].includes(item.id) ? { ...item, visible: false } : item,
  );
  items.push({
    id: "link-public",
    label: "영상 모음",
    area: "public",
    href: "https://example.com/videos",
    visible: true,
  });
  items.push({
    id: "link-private",
    label: "PRIVATE_ADMIN_LABEL",
    area: "work",
    href: "https://example.com/PRIVATE_ADMIN_URL",
    visible: true,
  });
  const response = await request(
    "/api/admin/navigation",
    "PUT",
    { items, expected_revision: 0 },
    auth,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const saved = await response.json();
  assert.equal(saved.revision, 1);
  assert.equal(saved.items.length, 8);
  assert.equal("updated_by" in saved, false);
  const publicResponse = await request("/api/navigation"),
    publicValue = await publicResponse.json();
  assert.deepEqual(
    publicValue.items.map((item) => item.id),
    ["home", "songs", "soop", "link-public"],
  );
  assert.equal(JSON.stringify(publicValue).includes("PRIVATE_ADMIN"), false);
  assert.equal("revision" in publicValue, false);
  assert.equal("updated_at" in publicValue, false);
  const other = await login();
  assert.deepEqual(
    (
      await (
        await request("/api/admin/navigation", "GET", undefined, other)
      ).json()
    ).items,
    saved.items,
  );
  assert.equal(
    (await request("/api/admin/songs", "GET", undefined, other)).status,
    200,
  );
});
test("navigation creation and updates are atomic and reject stale editors without overwriting the winner", async () => {
  const auth = await login(),
    items = defaultNavigation();
  const saves = await Promise.all(
    ["홈 A", "홈 B"].map((label) =>
      request(
        "/api/admin/navigation",
        "PUT",
        {
          items: items.map((item) =>
            item.id === "home" ? { ...item, label } : item,
          ),
          expected_revision: 0,
        },
        auth,
      ),
    ),
  );
  assert.deepEqual(saves.map((value) => value.status).sort(), [200, 409]);
  let saved = await (
    await request("/api/admin/navigation", "GET", undefined, auth)
  ).json();
  assert.equal(saved.revision, 1);
  const edits = await Promise.all(
    ["홈 C", "홈 D"].map((label) =>
      request(
        "/api/admin/navigation",
        "PUT",
        {
          items: items.map((item) =>
            item.id === "home" ? { ...item, label } : item,
          ),
          expected_revision: 1,
        },
        auth,
      ),
    ),
  );
  assert.deepEqual(edits.map((value) => value.status).sort(), [200, 409]);
  saved = await (
    await request("/api/admin/navigation", "GET", undefined, auth)
  ).json();
  assert.equal(saved.revision, 2);
  const stale = await request(
    "/api/admin/navigation",
    "PUT",
    { items, expected_revision: 0 },
    auth,
  );
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error.code, "NAVIGATION_CONFLICT");
  assert.deepEqual(
    await (
      await request("/api/admin/navigation", "GET", undefined, auth)
    ).json(),
    saved,
  );
});
test("navigation validation rejects unsafe links, unknown fields, removed essentials and invalid revisions without writes", async () => {
  const auth = await login(),
    items = defaultNavigation();
  const custom = {
    id: "link-safe",
    label: "링크",
    area: "public",
    href: "https://example.com/",
    visible: true,
  };
  const invalid = [
    items.slice(1),
    [...items, items[0]],
    items.map((item) =>
      item.id === "home" ? { ...item, visible: false } : item,
    ),
    items.map((item) =>
      item.id === "songs" ? { ...item, href: "/admin/users" } : item,
    ),
    items.map((item) =>
      item.id === "songs" ? { ...item, area: "work" } : item,
    ),
    items.map((item) => (item.id === "songs" ? { ...item, label: " " } : item)),
    items.map((item) =>
      item.id === "songs" ? { ...item, label: "x".repeat(25) } : item,
    ),
    [...items, { ...custom, href: "javascript:alert(1)" }],
    [...items, { ...custom, href: "data:text/html,test" }],
    [...items, { ...custom, href: "http://example.com/" }],
    [...items, { ...custom, href: "https://name:secret@example.com/" }],
    [...items, { ...custom, id: "__proto__" }],
    [...items, { ...custom, role: "admin" }],
    [
      ...items,
      ...Array.from({ length: 21 }, (_, index) => ({
        ...custom,
        id: "link-" + index,
      })),
    ],
  ];
  for (const candidate of invalid)
    assert.equal(
      (
        await request(
          "/api/admin/navigation",
          "PUT",
          { items: candidate, expected_revision: 0 },
          auth,
        )
      ).status,
      422,
    );
  for (const expected_revision of [
    undefined,
    -1,
    1.5,
    "0",
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.equal(
      (
        await request(
          "/api/admin/navigation",
          "PUT",
          { items, expected_revision },
          auth,
        )
      ).status,
      422,
    );
  assert.equal(
    (
      await request(
        "/api/admin/navigation",
        "PUT",
        { items, expected_revision: 0, updated_by: 1 },
        auth,
      )
    ).status,
    422,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM site_navigation").first()).n,
    0,
  );
});

test("CSV import replay, concurrent retries and conflicting reuse never duplicate one operation", async () => {
  const auth = await login(),
    csv = stringifyCSV([song({ title: "재시도 보호" })]),
    key = randomToken();
  const preview = await (
    await request("/api/admin/songs/import/preview", "POST", csv, auth, {
      "Content-Type": "text/csv",
    })
  ).json();
  const attempts = await Promise.all(
    Array.from({ length: 4 }, () => csvImport(auth, csv, { key, preview })),
  );
  for (const result of attempts)
    assert.equal(result.status, 200, await result.clone().text());
  const results = await Promise.all(attempts.map((result) => result.json()));
  assert.equal(results.filter((result) => !result.replayed).length, 1);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM songs").first()).total,
    1,
  );
  const changedBody = await csvImport(
    auth,
    stringifyCSV([song({ title: "다른 파일" })]),
    { key },
  );
  assert.equal(changedBody.status, 409);
  assert.equal((await changedBody.json()).error.code, "CSV_IMPORT_KEY_REUSED");
  const replay = await csvImport(auth, csv, { key, preview });
  assert.equal((await replay.json()).replayed, true);
});

test("CSV preview changes and new duplicate warnings require another explicit confirmation", async () => {
  const auth = await login(),
    csv = stringifyCSV([song({ title: "미리보기 경합" })]);
  const preview = await (
    await request("/api/admin/songs/import/preview", "POST", csv, auth, {
      "Content-Type": "text/csv",
    })
  ).json();
  await create(auth, song({ title: "미리보기 경합" }));
  const changed = await csvImport(auth, csv, { preview });
  assert.equal(changed.status, 409);
  const details = (await changed.json()).error.details;
  assert.equal(details.preview.warnings.length, 1);
  const unconfirmed = await csvImport(auth, csv, {
    preview: details.preview,
    confirmed: "no",
  });
  assert.equal(unconfirmed.status, 409);
  assert.equal(
    (await unconfirmed.json()).error.code,
    "CSV_DUPLICATES_REQUIRED",
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM songs").first()).total,
    1,
  );
  assert.equal(
    (await csvImport(auth, csv, { preview: details.preview, confirmed: "yes" }))
      .status,
    200,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM songs").first()).total,
    2,
  );
});

test("CSV final transaction rejects stale snapshots and cannot reuse an older attempt's claim", async () => {
  const { inspectCSV } = await import("../server/services/csv.js");
  const { commitSongImport } =
    await import("../server/repositories/song-imports.js");
  const owner = originalAdmin.id,
    csv = stringifyCSV([song({ title: "원자적 중복 검사" })]);
  const inspection = await inspectCSV(db, csv),
    key = randomToken();
  const first = await commitSongImport(db, {
    owner,
    key,
    bodyHash: "a".repeat(64),
    claim: randomToken(),
    ...inspection,
  });
  assert.equal(first.imported, 1);
  const sameKeyRace = await commitSongImport(db, {
    owner,
    key,
    bodyHash: "a".repeat(64),
    claim: randomToken(),
    ...inspection,
  });
  assert.equal(sameKeyRace, null);
  const differentKeyRace = await commitSongImport(db, {
    owner,
    key: randomToken(),
    bodyHash: "a".repeat(64),
    claim: randomToken(),
    ...inspection,
  });
  assert.equal(differentKeyRace, null);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM songs").first()).total,
    1,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM song_import_jobs").first())
      .total,
    1,
  );
});

test("CSV receipts and song rows roll back together, so a failed import remains retryable", async () => {
  const auth = await login(),
    csv = stringifyCSV([song({ title: "강제 저장 실패" })]),
    key = randomToken();
  const preview = await (
    await request("/api/admin/songs/import/preview", "POST", csv, auth, {
      "Content-Type": "text/csv",
    })
  ).json();
  await db
    .prepare(
      "CREATE TRIGGER qa_import_failure BEFORE INSERT ON songs BEGIN SELECT RAISE(ABORT, 'qa transaction failure'); END",
    )
    .run();
  try {
    assert.equal((await csvImport(auth, csv, { key, preview })).status, 503);
  } finally {
    await db.prepare("DROP TRIGGER qa_import_failure").run();
  }
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM song_import_jobs").first())
      .total,
    0,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM songs").first()).total,
    0,
  );
  assert.equal((await csvImport(auth, csv, { key, preview })).status, 200);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM songs").first()).total,
    1,
  );
});

test("CSV imports reject missing operation metadata without writing songs", async () => {
  const auth = await login(),
    csv = stringifyCSV([song()]);
  const missing = await request("/api/admin/songs/import", "POST", csv, auth, {
    "Content-Type": "text/csv",
  });
  assert.equal(missing.status, 422);
  assert.equal((await missing.json()).error.code, "CSV_IMPORT_KEY");
  const missingPreview = await request(
    "/api/admin/songs/import",
    "POST",
    csv,
    auth,
    { "Content-Type": "text/csv", "Idempotency-Key": randomToken() },
  );
  assert.equal(missingPreview.status, 422);
  assert.equal(
    (await missingPreview.json()).error.code,
    "CSV_PREVIEW_REQUIRED",
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM songs").first()).total,
    0,
  );
});

test("CSV preview recovers a completed operation for the same owner without importing it again", async () => {
  const auth = await login(),
    csv = stringifyCSV([song({ title: "창을 다시 연 등록" })]),
    key = randomToken();
  assert.equal((await csvImport(auth, csv, { key })).status, 200);
  const response = await request(
    "/api/admin/songs/import/preview",
    "POST",
    csv,
    auth,
    { "Content-Type": "text/csv", "Idempotency-Key": key },
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.completed.imported, 1);
  assert.equal(result.completed.replayed, true);
  assert.equal(
    (await db.prepare("SELECT COUNT(*) AS total FROM songs").first()).total,
    1,
  );
});

test("appearance changes require administrator, CSRF, same origin and a changed initial password", async () => {
  const path = "/api/admin/appearance",
    body = { theme: "garden", expected_revision: 0 };
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, "PUT", body)).status, 401);
  const auth = await login();
  assert.equal(
    (await request(path, "PUT", body, { ...auth, csrfToken: "" })).status,
    403,
  );
  assert.equal(
    (
      await request(path, "PUT", body, auth, {
        Origin: "https://elsewhere.invalid",
      })
    ).status,
    403,
  );
  await db.prepare("UPDATE admin_users SET must_change_password=1").run();
  assert.equal((await request(path, "PUT", body, auth)).status, 403);
  assert.deepEqual(await (await request("/api/appearance")).json(), {
    theme: "forest",
  });
  assert.equal(
    (
      await db
        .prepare(
          "SELECT COUNT(*) n FROM site_settings WHERE key='appearance.v1'",
        )
        .first()
    ).n,
    0,
  );
});
test("appearance uses atomic revisions and exposes only the selected preset publicly", async () => {
  const auth = await login(),
    path = "/api/admin/appearance";
  assert.deepEqual(await (await request(path, "GET", undefined, auth)).json(), {
    theme: "forest",
    revision: 0,
    updated_at: null,
  });
  await db
    .prepare(
      "INSERT INTO site_settings(key,value) VALUES ('other-setting','keep')",
    )
    .run();
  const winners = await Promise.all(
    ["garden", "starlight"].map((theme) =>
      request(path, "PUT", { theme, expected_revision: 0 }, auth),
    ),
  );
  assert.deepEqual(winners.map((r) => r.status).sort(), [200, 409]);
  const saved = await winners.find((r) => r.status === 200).json();
  assert.equal(saved.revision, 1);
  const publicResponse = await request("/api/appearance");
  assert.deepEqual(await publicResponse.json(), { theme: saved.theme });
  assert.match(publicResponse.headers.get("Cache-Control"), /no-store/);
  assert.equal(
    (
      await request(
        path,
        "PUT",
        { theme: "forest", expected_revision: 0 },
        auth,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        path,
        "PUT",
        { theme: "forest", expected_revision: 1 },
        auth,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        path,
        "PUT",
        { theme: "garden", expected_revision: 1 },
        auth,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT value FROM site_settings WHERE key='other-setting'")
        .first()
    ).value,
    "keep",
  );
});
test("appearance rejects injected settings and malformed revisions without modifying stored values", async () => {
  const auth = await login(),
    path = "/api/admin/appearance";
  for (const body of [
    { theme: "url(javascript:alert(1))", expected_revision: 0 },
    { theme: "forest", expected_revision: 0, css: "anything" },
    { theme: "forest", expected_revision: -1 },
    { theme: "forest", expected_revision: "0" },
    { theme: "forest" },
    { theme: null, expected_revision: 0 },
  ]) {
    const response = await request(path, "PUT", body, auth);
    assert.ok([400, 422].includes(response.status), await response.text());
  }
  assert.equal(
    (
      await db
        .prepare(
          "SELECT COUNT(*) n FROM site_settings WHERE key='appearance.v1'",
        )
        .first()
    ).n,
    0,
  );
});

const linkedAlbum = () => ({
  provider: "itunes",
  track_id: 1591865716,
  storefront: "US",
  title: "Narrow road",
  artist: "Lucia",
  album_title: "Narrow road",
  artwork_url:
    "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/example/100x100bb.jpg",
  source_url:
    "https://music.apple.com/us/album/narrow-road/1591865712?i=1591865716",
});
test("album linkage preserves local fields and private notes, validates hosts, and retains the CSV contract", async () => {
  const auth = await login(),
    album = linkedAlbum(),
    created = await create(auth, song({ album }));
  assert.deepEqual(created.album, album);
  assert.equal(created.title, song().title);
  assert.equal(created.memo, song().memo);
  const publicSong = await (await request("/api/songs/" + created.id)).json();
  assert.deepEqual(publicSong.album, album);
  assert.ok(!("memo" in publicSong));
  assert.ok(!("revision" in publicSong));
  for (const bad of [
    { ...album, artwork_url: "https://evil.test/a.jpg" },
    { ...album, source_url: "javascript:alert(1)" },
    { ...album, track_id: 2 },
    { ...album, privateMemo: "LEAK" },
  ])
    assert.equal(
      (
        await request(
          "/api/admin/songs/" + created.id,
          "PATCH",
          { album: bad, expected_revision: 1 },
          auth,
        )
      ).status,
      422,
    );
  assert.equal(
    (
      await request(
        "/api/admin/songs/" + created.id,
        "PATCH",
        { album: null, expected_revision: 1 },
        auth,
      )
    ).status,
    200,
  );
  assert.ok(
    !("album" in (await (await request("/api/songs/" + created.id)).json())),
  );
  const csv = await (
    await request("/api/admin/songs/export.csv", "GET", undefined, auth)
  ).text();
  assert.equal(
    csv
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)[0]
      .split(",").length,
    10,
  );
});
test("catalogue searches are protected, cached, globally bounded, and external failures do not block song saving", async () => {
  const { searchCatalog: queryCatalog } =
    await import("../server/services/catalog.js");
  // Keep minute-boundary/rate-limit coverage deterministic.
  const searchCatalog = (db, input, fetcher) =>
    queryCatalog(db, input, fetcher, 1800000000000);
  const auth = await login();
  const path = "/api/admin/catalog/search",
    input = { q: "소로", country: "US" };
  assert.equal((await request(path, "POST", input)).status, 401);
  assert.equal(
    (await request(path, "POST", input, { ...auth, csrfToken: "" })).status,
    403,
  );
  let calls = 0;
  const fetcher = async (url) => {
    calls++;
    assert.equal(new URL(url).hostname, "itunes.apple.com");
    const a = linkedAlbum();
    return Response.json({
      results: [
        {
          wrapperType: "track",
          kind: "song",
          trackId: a.track_id,
          trackName: a.title,
          artistName: a.artist,
          collectionName: a.album_title,
          artworkUrl100: a.artwork_url,
          trackViewUrl: a.source_url,
        },
      ],
    });
  };
  const data = await searchCatalog(db, input, fetcher);
  assert.equal(data.items.length, 1);
  assert.deepEqual(
    await searchCatalog(db, input, () => {
      throw Error("cache miss");
    }),
    data,
  );
  assert.equal(calls, 1);
  assert.equal((await request(path, "POST", input, auth)).status, 503);
  for (let index = 0; index < 9; index++)
    await searchCatalog(db, { ...input, q: "새 검색 " + index }, fetcher);
  await assert.rejects(
    () => searchCatalog(db, { ...input, q: "한도 초과" }, fetcher),
    (e) => e.status === 429 && e.retryAfter === 60,
  );
  const limit = await request(
    path,
    "POST",
    { ...input, q: "또 다른 검색" },
    auth,
  );
  assert.equal(limit.status, 503);
  assert.equal((await limit.json()).error.code, "CATALOG_PAUSED");
  await db.prepare("DELETE FROM catalog_limits").run();
  await assert.rejects(
    () =>
      searchCatalog(db, { ...input, q: "장애" }, async () => {
        throw Error("offline");
      }),
    (e) => e.code === "CATALOG_UNAVAILABLE",
  );
  assert.ok((await create(auth)).id);
});
test("homepage settings use atomic revisions, preserve menu-owned SOOP URLs, and exclude hidden featured songs", async () => {
  const { DEFAULT_PROFILE } = await import("../shared/site-profile.js");
  const auth = await login(),
    first = await create(auth),
    second = await create(auth, song({ title: "추천2" }));
  const items = defaultNavigation().map((item) =>
    item.id === "soop"
      ? {
          ...item,
          href: "https://www.sooplive.com/station/saved",
          visible: false,
        }
      : item,
  );
  assert.equal(
    (
      await request(
        "/api/admin/navigation",
        "PUT",
        { items, expected_revision: 0 },
        auth,
      )
    ).status,
    200,
  );
  const profile = {
    ...structuredClone(DEFAULT_PROFILE),
    intro_title: "지오의 새 인사",
    featured_ids: [second.id, first.id],
    social_links: [{ label: "공식 링크", href: "https://example.com/" }],
  };
  const results = await Promise.all(
    [1, 2].map(() =>
      request(
        "/api/admin/site",
        "PUT",
        { ...profile, expected_revision: 0 },
        auth,
      ),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const data = await (await request("/api/site")).json();
  assert.equal(data.intro_title, profile.intro_title);
  assert.equal(data.soop_url, "https://www.sooplive.com/station/saved");
  assert.deepEqual(
    data.featured.map((s) => s.id),
    [second.id, first.id],
  );
  assert.ok(!JSON.stringify(data).includes("PRIVATE_TEST_MEMO"));
  assert.ok(!("featured_ids" in data));
  await request(
    "/api/admin/songs/" + second.id,
    "PATCH",
    { is_public: false, expected_revision: 1 },
    auth,
  );
  assert.deepEqual(
    (await (await request("/api/site")).json()).featured.map((s) => s.id),
    [first.id],
  );
  for (const bad of [
    {
      ...profile,
      social_links: [{ label: "위험", href: "javascript:alert(1)" }],
    },
    { ...profile, featured_ids: [first.id, first.id] },
    { ...profile, featured_ids: [second.id] },
    { ...profile, css: "unsafe" },
  ])
    assert.equal(
      (
        await request(
          "/api/admin/site",
          "PUT",
          { ...bad, expected_revision: 1 },
          auth,
        )
      ).status,
      422,
    );
  assert.equal(
    (await (await request("/api/admin/site", "GET", undefined, auth)).json())
      .revision,
    1,
  );
});
test("trash restores songs privately with metadata intact and stale editors cannot overwrite a restored item", async () => {
  const auth = await login(),
    created = await create(auth, song({ album: linkedAlbum() })),
    path = "/api/admin/songs/" + created.id;
  assert.equal(
    (await request(path, "DELETE", { expected_revision: 1 }, auth)).status,
    200,
  );
  assert.equal((await request("/api/songs/" + created.id)).status, 404);
  assert.equal((await request(path, "GET", undefined, auth)).status, 404);
  assert.equal(
    (
      await (
        await request(
          "/api/admin/songs?include_filters=1",
          "GET",
          undefined,
          auth,
        )
      ).json()
    ).pagination.total,
    0,
  );
  const trash = await (
    await request("/api/admin/recovery/songs", "GET", undefined, auth)
  ).json();
  assert.equal(trash.items.length, 1);
  assert.ok(!JSON.stringify(trash).includes(song().memo));
  assert.equal(trash.items[0].revision, 2);
  const recovery = "/api/admin/recovery/songs/" + created.id;
  assert.equal(
    (
      await request(
        recovery + "/restore",
        "POST",
        { expected_revision: 1 },
        auth,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        recovery + "/restore",
        "POST",
        { expected_revision: 2 },
        auth,
      )
    ).status,
    200,
  );
  const restored = await (await request(path, "GET", undefined, auth)).json();
  assert.equal(restored.is_public, false);
  assert.equal(restored.revision, 3);
  assert.equal(restored.memo, song().memo);
  assert.deepEqual(restored.album, linkedAlbum());
  assert.equal(
    (
      await request(
        path,
        "PATCH",
        { title: "이전 편집", expected_revision: 1 },
        auth,
      )
    ).status,
    409,
  );
  assert.equal(
    (await request(recovery, "DELETE", { expected_revision: 3 }, auth)).status,
    409,
  );
  await request(path, "DELETE", { expected_revision: 3 }, auth);
  assert.equal(
    (await request(recovery, "DELETE", { expected_revision: 4 }, auth)).status,
    200,
  );
  assert.equal(
    await db
      .prepare("SELECT id FROM songs WHERE id=?")
      .bind(created.id)
      .first(),
    null,
  );
  const history = await (
    await request("/api/admin/recovery/history", "GET", undefined, auth)
  ).json();
  assert.deepEqual(
    history.items.map((row) => row.action),
    ["purge", "trash", "restore", "trash", "create"],
  );
  assert.ok(
    history.items.every((row) => row.actor === originalAdmin.display_name),
  );
  assert.ok(!JSON.stringify(history).includes(song().memo));
});
test("individual event recovery keeps times and other events while remaining absent from normal lists and backups in trash", async () => {
  const auth = await login(),
    event = await createScheduleEvent(auth),
    other = await createScheduleEvent(auth, { title: "남겨둘 일정" });
  const path = "/api/admin/schedule-events/" + event.id;
  assert.equal(
    (await request(path, "DELETE", { expected_revision: 1 }, auth)).status,
    200,
  );
  assert.equal((await request(path, "GET", undefined, auth)).status, 404);
  const backup = await (
    await request("/api/admin/schedule-events/backup", "GET", undefined, auth)
  ).json();
  assert.deepEqual(
    backup.items.map((row) => row.id),
    [other.id],
  );
  const recovery = "/api/admin/recovery/events/" + event.id;
  assert.equal(
    (
      await request(
        recovery + "/restore",
        "POST",
        { expected_revision: 2 },
        auth,
      )
    ).status,
    200,
  );
  const restored = await (await request(path, "GET", undefined, auth)).json();
  assert.equal(restored.starts_at, event.starts_at);
  assert.equal(restored.ends_at, event.ends_at);
  assert.equal(restored.revision, 3);
  assert.equal(
    (
      await request(
        path,
        "PUT",
        { ...eventPayload(), title: "이전 편집", expected_revision: 1 },
        auth,
      )
    ).status,
    409,
  );
});
test("bulk song edits report stale rows separately, preserve private data, and reject invalid batches without writes", async () => {
  const auth = await login(),
    first = await create(auth, song({ title: "일괄1", album: linkedAlbum() })),
    second = await create(auth, song({ title: "일괄2" }));
  await request(
    "/api/admin/songs/" + second.id,
    "PATCH",
    { proficiency: 5, expected_revision: 1 },
    auth,
  );
  const body = {
    items: [first, second].map((row) => ({
      id: row.id,
      expected_revision: row.revision,
    })),
    changes: { practice_status: "completed" },
  };
  const result = await (
    await request("/api/admin/songs/bulk", "PATCH", body, auth)
  ).json();
  assert.deepEqual(result, { applied: [first.id], conflicted: [second.id] });
  const saved = await (
    await request("/api/admin/songs/" + first.id, "GET", undefined, auth)
  ).json();
  assert.equal(saved.practice_status, "completed");
  assert.equal(saved.proficiency, first.proficiency);
  assert.equal(saved.memo, first.memo);
  assert.deepEqual(saved.album, first.album);
  for (const invalid of [
    { ...body, changes: { memo: "DO NOT CHANGE" } },
    { ...body, changes: { proficiency: 0 } },
    { ...body, items: [body.items[0], body.items[0]] },
    {
      ...body,
      items: Array.from({ length: 21 }, (_, i) => ({
        id: i + 1,
        expected_revision: 1,
      })),
    },
  ])
    assert.equal(
      (await request("/api/admin/songs/bulk", "PATCH", invalid, auth)).status,
      422,
    );
  const history = await (
    await request("/api/admin/recovery/history", "GET", undefined, auth)
  ).json();
  assert.equal(
    history.items.filter((row) => row.action === "update").length,
    2,
  );
});
test("admin status revokes sessions, preserves content, rejects self/stale changes and supports safe reactivation", async () => {
  const auth = await login();
  const created = await request(
    "/api/admin/users",
    "POST",
    {
      username: "status-target",
      display_name: "중지 대상",
      password,
      password_confirmation: password,
    },
    auth,
  );
  assert.equal(created.status, 201);
  const target = await created.json();
  const signIn = async () => {
    const response = await request("/api/admin/login", "POST", {
      username: "status-target",
      password,
    });
    assert.equal(response.status, 200);
    const value = await response.json();
    return {
      cookie: response.headers.get("Set-Cookie").split(";")[0],
      csrfToken: value.csrfToken,
    };
  };
  let other = await signIn();
  const content = await create(other);
  const path = "/api/admin/users/" + target.id;
  assert.equal(
    (
      await request(
        "/api/admin/users/" + originalAdmin.id + "/status",
        "PATCH",
        { is_active: false, expected_revision: 1 },
        auth,
      )
    ).status,
    422,
  );
  assert.equal(
    (await request(path + "/revoke-sessions", "POST", undefined, auth)).status,
    200,
  );
  assert.equal(
    (await request("/api/admin/me", "GET", undefined, other)).status,
    401,
  );
  other = await signIn();
  assert.equal(
    (
      await request(
        path + "/status",
        "PATCH",
        { is_active: false, expected_revision: 1 },
        auth,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/admin/me", "GET", undefined, other)).status,
    401,
  );
  assert.equal(
    (
      await request("/api/admin/login", "POST", {
        username: "status-target",
        password,
      })
    ).status,
    401,
  );
  assert.equal(
    (await request("/api/admin/songs/" + content.id, "GET", undefined, auth))
      .status,
    200,
  );
  assert.equal(
    (
      await request(
        path + "/status",
        "PATCH",
        { is_active: true, expected_revision: 1 },
        auth,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        path + "/status",
        "PATCH",
        { is_active: true, expected_revision: 2 },
        auth,
      )
    ).status,
    200,
  );
  await signIn();
  const list = await (
    await request("/api/admin/users", "GET", undefined, auth)
  ).json();
  assert.ok(!JSON.stringify(list).includes("password_hash"));
  assert.equal(list.items.find((row) => row.id === target.id).revision, 3);
});
test("new management operations share authentication, origin, CSRF and forced-password protection", async () => {
  const auth = await login();
  const operations = [
    ["PUT", "/api/admin/site", {}],
    ["POST", "/api/admin/catalog/search", { q: "test", country: "US" }],
    ["PATCH", "/api/admin/songs/bulk", {}],
    ["POST", "/api/admin/recovery/songs/1/restore", { expected_revision: 1 }],
    ["DELETE", "/api/admin/recovery/events/1", { expected_revision: 1 }],
    [
      "PATCH",
      "/api/admin/users/99/status",
      { expected_revision: 1, is_active: false },
    ],
    ["POST", "/api/admin/users/99/revoke-sessions", undefined],
  ];
  for (const [method, path, body] of operations) {
    assert.equal((await request(path, method, body)).status, 401);
    assert.equal(
      (await request(path, method, body, { ...auth, csrfToken: "" })).status,
      403,
    );
    assert.equal(
      (
        await request(path, method, body, auth, {
          Origin: "https://elsewhere.invalid",
        })
      ).status,
      403,
    );
  }
  for (const path of [
    "/api/admin/site",
    "/api/admin/recovery/songs",
    "/api/admin/recovery/events",
    "/api/admin/recovery/history",
  ])
    assert.equal((await request(path)).status, 401);
  await db
    .prepare("UPDATE admin_users SET must_change_password=1 WHERE id=?")
    .bind(originalAdmin.id)
    .run();
  for (const [method, path, body] of operations)
    assert.equal((await request(path, method, body, auth)).status, 403);
});

test("concurrent administrators cannot deactivate each other into a zero-active-account state", async () => {
  const auth = await login();
  const r = await request(
    "/api/admin/users",
    "POST",
    {
      username: "race-admin",
      display_name: "동시 변경",
      password,
      password_confirmation: password,
    },
    auth,
  );
  const target = await r.json();
  const response = await request("/api/admin/login", "POST", {
    username: "race-admin",
    password,
  });
  const signed = await response.json();
  const other = {
    cookie: response.headers.get("Set-Cookie").split(";")[0],
    csrfToken: signed.csrfToken,
  };
  const primary = await db
    .prepare("SELECT revision FROM admin_users WHERE id=?")
    .bind(originalAdmin.id)
    .first();
  const results = await Promise.all([
    request(
      "/api/admin/users/" + target.id + "/status",
      "PATCH",
      { is_active: false, expected_revision: 1 },
      auth,
    ),
    request(
      "/api/admin/users/" + originalAdmin.id + "/status",
      "PATCH",
      { is_active: false, expected_revision: primary.revision },
      other,
    ),
  ]);
  assert.equal(results.filter((row) => row.status === 200).length, 1);
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) n FROM admin_users WHERE is_active=1")
        .first()
    ).n,
    1,
  );
});
test("album-inclusive backup is paged and authenticated and excludes trash and actor fields", async () => {
  const auth = await login(),
    first = await create(auth, song({ album: linkedAlbum() })),
    second = await create(auth, song({ title: "백업 다음 곡" }));
  assert.equal((await request("/api/admin/songs/backup")).status, 401);
  let value = await (
    await request("/api/admin/songs/backup", "GET", undefined, auth)
  ).json();
  assert.equal(value.items.length, 2);
  assert.deepEqual(value.items[0].album, linkedAlbum());
  assert.equal(value.items[0].memo, song().memo);
  assert.ok(!("updated_by" in value.items[0]));
  assert.equal(value.next_after, null);
  value = await (
    await request(
      "/api/admin/songs/backup?after=" + first.id,
      "GET",
      undefined,
      auth,
    )
  ).json();
  assert.deepEqual(
    value.items.map((row) => row.id),
    [second.id],
  );
  await request(
    "/api/admin/songs/" + first.id,
    "DELETE",
    { expected_revision: 1 },
    auth,
  );
  value = await (
    await request("/api/admin/songs/backup", "GET", undefined, auth)
  ).json();
  assert.deepEqual(
    value.items.map((row) => row.id),
    [second.id],
  );
  for (const query of ["after=-1", "after=0", "after=1&after=2", "other=1"])
    assert.equal(
      (
        await request(
          "/api/admin/songs/backup?" + query,
          "GET",
          undefined,
          auth,
        )
      ).status,
      400,
    );
});

test("paused catalogue rejects authenticated calls without external requests or cache writes", async () => {
  const auth = await login();
  for (const country of ["US", "KR"]) {
    const response = await request(
      "/api/admin/catalog/search",
      "POST",
      { q: "검은행복", country },
      auth,
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "CATALOG_PAUSED");
  }
  assert.equal(
    (await db.prepare("SELECT COUNT(*) total FROM catalog_cache").first())
      .total,
    0,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) total FROM catalog_limits").first())
      .total,
    0,
  );
  upstreamMock.assertNoPendingInterceptors();
});
test("uploaded covers save atomically, stay out of lists, obey visibility, and survive backup/copy/restore", async () => {
  const { coverImage } = await import("./fixtures/song-image.js");
  const auth = await login(),
    created = await create(
      auth,
      song({ cover_image: coverImage, album: linkedAlbum() }),
    );
  assert.equal(created.cover_image, coverImage);
  const path = "/api/songs/" + created.id + "/cover",
    adminPath = "/api/admin/songs/" + created.id + "/cover";
  const publicSong = await (await request("/api/songs/" + created.id)).json();
  assert.equal(publicSong.cover_url, path + "?v=1");
  assert.equal(publicSong.cover_image, undefined);
  assert.equal(publicSong.memo, undefined);
  for (const url of ["/api/songs", "/api/admin/songs"]) {
    const list = await (
      await request(
        url,
        "GET",
        undefined,
        url.includes("/admin/") ? auth : undefined,
      )
    ).json();
    assert.equal(list.items[0].cover_image, undefined);
  }
  const photo = await request(path);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get("Content-Type"), "image/webp");
  assert.equal(photo.headers.get("Cache-Control"), "no-store");
  assert.equal(photo.headers.get("X-Content-Type-Options"), "nosniff");
  assert.deepEqual(
    new Uint8Array(await photo.arrayBuffer()),
    Uint8Array.from(atob(coverImage.split(",")[1]), (c) => c.charCodeAt(0)),
  );
  assert.equal((await request(adminPath)).status, 401);
  const denied = await request(
    "/api/admin/songs/" + created.id,
    "PATCH",
    { cover_image: null, expected_revision: 1 },
    { ...auth, csrfToken: "" },
  );
  assert.equal(denied.status, 403);
  const hidden = await request(
    "/api/admin/songs/" + created.id,
    "PATCH",
    { is_public: false, expected_revision: 1 },
    auth,
  );
  assert.equal(hidden.status, 200);
  assert.equal((await request(path)).status, 404);
  assert.equal((await request(adminPath, "GET", undefined, auth)).status, 200);
  const stale = await request(
    "/api/admin/songs/" + created.id,
    "PATCH",
    { cover_image: null, expected_revision: 1 },
    auth,
  );
  assert.equal(stale.status, 409);
  const saved = await (
    await request("/api/admin/songs/" + created.id, "GET", undefined, auth)
  ).json();
  assert.equal(saved.cover_image, coverImage);
  const backup = await (
    await request("/api/admin/songs/backup", "GET", undefined, auth)
  ).json();
  assert.equal(backup.items[0].cover_image, coverImage);
  const copy = await create(
    auth,
    song({ cover_image: saved.cover_image, is_public: false }),
  );
  assert.equal(copy.cover_image, coverImage);
  assert.equal(
    (
      await request(
        "/api/admin/songs/" + created.id,
        "DELETE",
        { expected_revision: 2 },
        auth,
      )
    ).status,
    200,
  );
  assert.equal((await request(adminPath, "GET", undefined, auth)).status, 404);
  assert.equal(
    (
      await request(
        "/api/admin/recovery/songs/" + created.id + "/restore",
        "POST",
        { expected_revision: 3 },
        auth,
      )
    ).status,
    200,
  );
  const restored = await (
    await request("/api/admin/songs/" + created.id, "GET", undefined, auth)
  ).json();
  assert.equal(restored.cover_image, coverImage);
  assert.equal(restored.is_public, false);
  assert.equal((await request(path)).status, 404);
  const removed = await request(
    "/api/admin/songs/" + created.id,
    "PATCH",
    { cover_image: null, expected_revision: restored.revision },
    auth,
  );
  assert.equal(removed.status, 200);
  const result = await removed.json();
  assert.equal(result.cover_image, null);
  assert.equal(result.cover_url, undefined);
  assert.deepEqual(result.album, linkedAlbum());
  assert.equal((await request(adminPath, "GET", undefined, auth)).status, 404);
});
test("cover validation rejects SVG, forged files, oversized input and unauthorized writes", async () => {
  const auth = await login();
  for (const value of [
    "data:image/svg+xml;base64,PHN2Zz4=",
    "https://evil.test/a.webp",
    "data:image/webp;base64,PHN2Zz4=",
    false,
    {},
    "data:image/webp;base64," + "A".repeat(44000),
  ]) {
    assert.equal(
      (
        await request(
          "/api/admin/songs",
          "POST",
          song({ cover_image: value }),
          auth,
        )
      ).status,
      422,
    );
  }
  assert.equal(
    (await request("/api/admin/songs", "POST", song({ cover_image: null })))
      .status,
    401,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) total FROM songs").first()).total,
    0,
  );
});
