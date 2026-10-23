import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { loginAdmin, adminHeaders } from "./support/admin.js";
const path = "/admin/album-lab",
  password = randomUUID() + "-Lab",
  raw = {
    wrapperType: "track",
    kind: "song",
    trackId: 1591865716,
    trackName: "Black Happiness",
    artistName: "YOON MIRAE",
    collectionName: "Album",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/test/100x100bb.jpg",
    trackViewUrl: "https://music.apple.com/us/album/a/1?i=1591865716",
  };
let created = false;
async function owner(page) {
  await loginAdmin(page);
  if (!created) {
    const result = await page.request.post("/api/admin/users", {
      headers: await adminHeaders(page),
      data: {
        username: "admin",
        display_name: "실험실 검증",
        password,
        password_confirmation: password,
      },
    });
    expect(result.status()).toBe(201);
    created = true;
  }
  await page.goto("/admin/login");
  await page.getByLabel("아이디", { exact: true }).fill("admin");
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
test.afterAll(() => {
  if (created)
    execFileSync(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "d1",
        "execute",
        "zio-home-db",
        "--local",
        "--persist-to",
        ".local/e2e/state",
        "--config",
        "wrangler.jsonc",
        "--command",
        "DELETE FROM admin_sessions WHERE admin_user_id IN (SELECT id FROM admin_users WHERE username='admin'); DELETE FROM admin_users WHERE username='admin';",
      ],
      { stdio: "pipe" },
    );
});
test("lab entry is absent for visitors/other administrators and native URL access is protected", async ({
  page,
}) => {
  const response = await page.request.get(path, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "앨범 연결 실험실", exact: true }),
  ).toHaveCount(0);
  await loginAdmin(page);
  await expect(
    page.getByRole("link", { name: "앨범 연결 실험실", exact: true }),
  ).toHaveCount(0);
  expect((await page.request.get(path, { maxRedirects: 0 })).status()).toBe(
    404,
  );
  expect((await page.request.get("/api/admin/album-lab")).status()).toBe(404);
});
test("owner icon opens a private document and both search paths preview without saving any song", async ({
  page,
}) => {
  await owner(page);
  const writes = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/api/admin/songs") &&
      request.method() !== "GET"
    )
      writes.push(request.url());
  });
  const navigation = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === path &&
      response.request().isNavigationRequest(),
  );
  await page
    .getByRole("link", { name: "앨범 연결 실험실", exact: true })
    .click();
  const document = await navigation;
  expect(document.status()).toBe(200);
  expect(document.headers()["content-security-policy"]).toContain(
    "connect-src 'self' https://itunes.apple.com",
  );
  expect(document.headers()["x-robots-tag"]).toContain("noindex");
  await expect(
    page.getByRole("heading", { name: "앨범 연결 실험실", exact: true }),
  ).toBeVisible();
  await page.route("https://itunes.apple.com/search?*", (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ results: [raw] }),
    }),
  );
  await page
    .getByRole("button", { name: "앨범 검색 테스트", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("연결 성공");
  await page
    .getByRole("button", { name: "Black Happiness 연결 미리보기", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "앨범 연결 미리보기" }),
  ).toContainText("YOON MIRAE");
  await page
    .getByRole("button", { name: "테스트 연결 해제", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "앨범 연결 미리보기" }),
  ).toHaveCount(0);
  await page.route("**/api/admin/album-lab/search", (route) =>
    route.fulfill({
      json: {
        ok: false,
        items: [],
        upstream_status: 429,
        elapsed_ms: 100,
        message: "Apple이 홈페이지 서버의 검색 요청을 제한했어요.",
      },
    }),
  );
  await page.getByLabel("홈페이지 서버를 거쳐서", { exact: true }).check();
  await page
    .getByRole("button", { name: "앨범 검색 테스트", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("HTTP 429");
  expect(writes).toEqual([]);
  await page.getByRole("link", { name: "노래 관리로", exact: false }).click();
  await expect(page).toHaveURL(/\/admin\/songs$/);
});
test("lab handles empty results, failed connections, cancellation and five responsive sizes", async ({
  page,
}) => {
  await owner(page);
  await page.goto(path);
  await page.getByLabel("검색 국가", { exact: true }).selectOption("KR");
  await page.route("https://itunes.apple.com/search?*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ results: [] }),
    }),
  );
  await page
    .getByRole("button", { name: "앨범 검색 테스트", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("검색 결과가 없어요");
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [768, 1024],
    [390, 844],
    [360, 800],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.unroute("https://itunes.apple.com/search?*");
  await page.route("https://itunes.apple.com/search?*", (route) =>
    route.abort(),
  );
  await page
    .getByRole("button", { name: "앨범 검색 테스트", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("연결하지 못했어요");
  await page.unroute("https://itunes.apple.com/search?*");
  let release;
  const pending = new Promise((resolve) => (release = resolve));
  await page.route("https://itunes.apple.com/search?*", async (route) => {
    await pending;
    await route
      .fulfill({
        contentType: "application/json",
        body: JSON.stringify({ results: [raw] }),
      })
      .catch(() => {});
  });
  await page
    .getByRole("button", { name: "앨범 검색 테스트", exact: true })
    .click();
  await page.getByRole("button", { name: "검색 취소", exact: true }).click();
  release();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "앨범 검색 테스트", exact: true }),
  ).toBeEnabled();
});
