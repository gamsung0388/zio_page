import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { loginAdmin, adminHeaders } from "./support/admin.js";
const themeKey = "zio:theme:preference:v1";
async function rootTheme(page, theme) {
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}
async function picker(page) {
  await page
    .getByRole("button", { name: "화면 테마 선택", exact: true })
    .click();
  return page.getByRole("dialog", { name: "나의 음악 공간", exact: true });
}
test.afterEach(async ({ page }) => {
  const result = await page.request.get("/api/admin/appearance");
  if (result.ok()) {
    const data = await result.json();
    await page.request.put("/api/admin/appearance", {
      headers: await adminHeaders(page),
      data: { theme: "forest", expected_revision: data.revision },
    });
  }
});
test("visitor choice persists only in the same browser and site default can be restored", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await rootTheme(page, "forest");
  let dialog = await picker(page);
  await dialog.getByRole("radio", { name: /별빛 음악방/ }).check();
  await rootTheme(page, "starlight");
  await dialog.getByRole("button", { name: "선택 완료" }).click();
  await expect(
    page.getByRole("button", { name: "화면 테마 선택" }),
  ).toBeFocused();
  await page.reload();
  await rootTheme(page, "starlight");
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await other.goto("http://127.0.0.1:5174/");
    await rootTheme(other, "forest");
  } finally {
    await context.close();
  }
  dialog = await picker(page);
  await dialog.getByRole("radio", { name: /사이트 기본값 따르기/ }).check();
  await rootTheme(page, "forest");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
test("admin preview cancels without writes; saved default respects a personal choice and reaches visitors", async ({
  page,
  browser,
}) => {
  await loginAdmin(page);
  let dialog = await picker(page);
  await dialog.getByRole("radio", { name: /별빛 음악방/ }).check();
  await page.keyboard.press("Escape");
  await page.goto("/admin/menus");
  await page.getByRole("link", { name: "테마 설정", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("테마 설정");
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "PUT" && r.url().endsWith("/api/admin/appearance"))
      writes++;
  });
  await page.getByRole("radio", { name: /햇살 정원/ }).check();
  await page.getByRole("button", { name: "이 테마 미리보기" }).click();
  await rootTheme(page, "garden");
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "미리보기 종료" }).click();
  await rootTheme(page, "starlight");
  await page.getByRole("button", { name: "기본 테마 저장" }).click();
  await expect(
    page.getByRole("button", { name: "기본 테마 저장" }),
  ).toBeDisabled();
  await rootTheme(page, "starlight");
  expect(writes).toBe(1);
  const context = await browser.newContext();
  try {
    const visitor = await context.newPage();
    await visitor.goto("http://127.0.0.1:5174/");
    await rootTheme(visitor, "garden");
  } finally {
    await context.close();
  }
  dialog = await picker(page);
  await dialog.getByRole("radio", { name: /사이트 기본값 따르기/ }).check();
  await rootTheme(page, "garden");
  await page.keyboard.press("Escape");
  await page.getByRole("radio", { name: /숲속 음악방/ }).check();
  await page.getByRole("button", { name: "이 테마 미리보기" }).click();
  await rootTheme(page, "forest");
  await page.getByRole("button", { name: "선택 취소" }).click();
  await rootTheme(page, "garden");
  expect(writes).toBe(1);
});
test("unsaved admin selection guards navigation and stale saves keep the winning site default", async ({
  page,
}) => {
  await loginAdmin(page);
  await page.goto("/admin/appearance");
  await page.getByRole("radio", { name: /햇살 정원/ }).check();
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("link", { name: "메뉴 구성", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/appearance$/);
  const current = await (
    await page.request.get("/api/admin/appearance")
  ).json();
  const winner = await page.request.put("/api/admin/appearance", {
    headers: await adminHeaders(page),
    data: { theme: "starlight", expected_revision: current.revision },
  });
  expect(winner.ok()).toBe(true);
  await page.getByRole("button", { name: "기본 테마 저장" }).click();
  await expect(page.getByRole("alert")).toContainText("다른 관리자가");
  await expect(page.getByRole("radio", { name: /햇살 정원/ })).toBeChecked();
  await page.getByRole("radio", { name: /숲속 음악방/ }).check();
  await expect(page.getByRole("alert")).toContainText("다른 관리자가");
  await expect(page.getByRole("button", { name: "선택 취소" })).toBeDisabled();
  await page.getByRole("radio", { name: /햇살 정원/ }).check();
  await page.getByRole("button", { name: "선택 취소" }).click();
  await expect(page.getByRole("alert")).toContainText("다른 관리자가");
  await page.getByRole("button", { name: "최신 설정 불러오기" }).click();
  await expect(page.getByRole("radio", { name: /별빛 음악방/ })).toBeChecked();
  await rootTheme(page, "starlight");
});
test("blocked browser storage and unavailable appearance service do not break public pages", async ({
  page,
}) => {
  const issues = [];
  page.on("pageerror", (e) => issues.push(e.message));
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem"]) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (key, ...args) {
        if (String(key).startsWith("zio:theme:"))
          throw new Error("Storage disabled");
        return original.call(this, key, ...args);
      };
    }
  });
  await page.route("**/api/appearance", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "temporarily unavailable" } }),
    }),
  );
  await page.goto("/songs");
  await expect(page.locator("h1")).toBeVisible();
  const dialog = await picker(page);
  await dialog.getByRole("radio", { name: /별빛 음악방/ }).check();
  await rootTheme(page, "starlight");
  await expect(dialog.getByRole("status")).toContainText("저장하지 못했어요");
  expect(issues).toEqual([]);
});
test("theme settings keep existing administrator login protection", async ({
  page,
}) => {
  await page.goto("/admin/appearance");
  await expect(page).toHaveURL(/\/admin\/login\?next=\/admin\/appearance/);
  await page
    .getByLabel("아이디", { exact: true })
    .fill(process.env.ZIO_E2E_USERNAME);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(process.env.ZIO_E2E_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/appearance$/);
});
for (const [width, height] of [
  [1920, 1080],
  [1440, 900],
  [768, 1024],
  [390, 844],
  [360, 800],
])
  test(`three themes stay usable on public and admin screens at ${width}x${height}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    await loginAdmin(page);
    const problems = [];
    page.on("pageerror", (e) => problems.push(e.message));
    const response = await page.request.post("/api/admin/songs", {
      headers: await adminHeaders(page),
      data: {
        title: "화면 확인용 노래",
        artist: "지오",
        genre: "발라드",
        language: "한국어",
        description: "오늘을 채우는 작은 노래",
        memo: "PRIVATE_APPEARANCE_TEST",
        proficiency: 4,
        practice_status: "practicing",
        balloon_cost: 3,
        is_public: true,
      },
    });
    expect(response.ok()).toBe(true);
    const song = await response.json();
    try {
      await mkdir("test-results/appearance", { recursive: true });
      for (const theme of ["forest", "garden", "starlight"]) {
        await page.evaluate(
          ({ themeKey, theme }) => localStorage.setItem(themeKey, theme),
          { themeKey, theme },
        );
        for (const [name, url] of [
          ["home", "/"],
          ["songs", "/songs"],
          ["detail", `/songs/${song.id}`],
          ["new", "/admin/songs/new"],
          ["edit", `/admin/songs/${song.id}/edit`],
          ["settings", "/admin/appearance"],
        ]) {
          await page.goto(url);
          await rootTheme(page, theme);
          await expect(page.locator("h1")).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          if (name === "detail")
            await expect(page.locator("main")).not.toContainText(
              "PRIVATE_APPEARANCE_TEST",
            );
          const broken = await page
            .locator("main img")
            .evaluateAll((images) =>
              images
                .filter((img) => img.complete && !img.naturalWidth)
                .map((img) => img.src),
            );
          expect(broken).toEqual([]);
          await page.screenshot({
            path: `test-results/appearance/${theme}-${name}-${width}.png`,
            fullPage: true,
          });
        }
      }
      expect(problems).toEqual([]);
    } finally {
      await page.request.delete(`/api/admin/songs/${song.id}`, {
        headers: await adminHeaders(page),
        data: { expected_revision: song.revision },
      });
    }
  });
