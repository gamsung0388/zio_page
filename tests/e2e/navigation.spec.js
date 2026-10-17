import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { defaultNavigation } from "../../shared/navigation.js";
import {
  loginAdmin as login,
  adminHeaders as headers,
} from "./support/admin.js";

test.beforeEach(async ({ page }) => {
  await login(page);
});
test.afterEach(async ({ page }) => {
  const response = await page.request.get("/api/admin/navigation");
  if (response.ok()) {
    const data = await response.json();
    await page.request.put("/api/admin/navigation", {
      headers: await headers(page),
      data: { items: defaultNavigation(), expected_revision: data.revision },
    });
  }
});
async function menus(page) {
  await page.goto("/admin/menus");
  await expect(page.locator(".menu-edit-row")).toHaveCount(6);
}
async function add(
  page,
  {
    label = "지오 영상",
    href = "https://example.com/videos",
    area = "public",
  } = {},
) {
  await page.getByRole("button", { name: "새 링크 추가", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "새 링크 추가",
    exact: true,
  });
  await dialog.getByLabel("메뉴 이름", { exact: true }).fill(label);
  await dialog.getByLabel("링크 주소", { exact: true }).fill(href);
  await dialog.getByLabel("표시 위치", { exact: true }).selectOption(area);
  await dialog
    .getByRole("button", { name: "편집에 적용", exact: true })
    .click();
  return dialog;
}
test("management groups two settings destinations independently from song and schedule work", async ({
  page,
}) => {
  const cards = page.getByRole("navigation", {
    name: "관리 기능 선택",
    exact: true,
  });
  await expect(cards.getByRole("link")).toHaveCount(2);
  await expect(
    cards.getByRole("link", { name: "관리자 관리", exact: true }),
  ).toHaveAttribute("href", "/admin/users");
  await expect(
    cards.getByRole("link", { name: "메뉴 관리", exact: true }),
  ).toHaveAttribute("href", "/admin/menus");
  await expect(
    page.locator(".sidebar-management-children").getByRole("link"),
  ).toHaveCount(2);
  const work = page
    .getByRole("navigation", { name: "주 메뉴" })
    .getByRole("group", { name: "운영", exact: true });
  await expect(
    work.getByRole("link", { name: "노래 관리", exact: true }),
  ).toBeVisible();
  await expect(
    work.getByRole("link", { name: "일정 관리", exact: true }),
  ).toBeVisible();
  let navigationReads = 0;
  page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      request.url().endsWith("/api/admin/navigation")
    )
      navigationReads++;
  });
  await cards.getByRole("link", { name: "관리자 관리", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await page
    .getByRole("navigation", { name: "관리자 메뉴", exact: true })
    .getByRole("link", { name: "관리 홈", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
  expect(navigationReads).toBe(0);
  await cards.getByRole("link", { name: "메뉴 관리", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/menus$/);
  await expect(
    page
      .locator(".sidebar-management-children")
      .getByRole("link", { name: "메뉴 관리", exact: true }),
  ).toHaveClass(/active/);
  await page.context().clearCookies();
  await page.goto("/admin/menus");
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
});
test("rename, ordering, visibility and new links save once and public menus omit private links", async ({
  page,
  browser,
}) => {
  await menus(page);
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      request.url().endsWith("/api/admin/navigation")
    )
      writes++;
  });
  await page
    .getByRole("button", { name: "노래책자 메뉴 수정", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "메뉴 수정", exact: true });
  await dialog.getByLabel("메뉴 이름", { exact: true }).fill("노래 찾기");
  await dialog
    .getByRole("button", { name: "편집에 적용", exact: true })
    .click();
  await page
    .getByRole("switch", { name: "지오 소개 표시", exact: true })
    .click();
  await page
    .getByRole("button", { name: "노래 찾기 아래로 이동", exact: true })
    .click();
  await add(page);
  await add(page, {
    label: "가".repeat(24),
    href: "https://example.com/footer",
    area: "footer",
  });
  await add(page, {
    label: "진행 노트",
    href: "https://example.com/private-admin-notes",
    area: "work",
  });
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "메뉴 저장", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "메뉴 저장", exact: true }),
  ).toBeDisabled();
  expect(writes).toBe(1);
  const nav = page.getByRole("navigation", { name: "주 메뉴" });
  await expect(
    nav.getByRole("link", { name: "노래 찾기", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "지오 소개", exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "진행 노트 (새 창)", exact: true }),
  ).toBeVisible();
  const publicData = await (await page.request.get("/api/navigation")).json();
  expect(JSON.stringify(publicData)).not.toContain("private-admin-notes");
  expect(
    publicData.items
      .filter((item) => item.area === "public")
      .map((item) => item.label),
  ).toEqual(["홈", "노래 찾기", "지오 영상"]);
  const visitor = await browser.newContext({
      baseURL: "http://127.0.0.1:5174",
    }),
    publicPage = await visitor.newPage();
  await publicPage.goto("/");
  await expect(
    publicPage
      .getByRole("navigation", { name: "주 메뉴" })
      .getByRole("link", { name: "노래 찾기", exact: true }),
  ).toBeVisible();
  const external = publicPage.getByRole("link", {
    name: "지오 영상 (새 창)",
    exact: true,
  });
  await expect(external).toHaveAttribute("href", "https://example.com/videos");
  await expect(external).toHaveAttribute("target", "_blank");
  await expect(external).toHaveAttribute("rel", "noopener noreferrer");
  await expect(publicPage.locator(".sidebar-management-children")).toHaveCount(
    0,
  );
  expect(
    await publicPage
      .locator(".sidebar")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await visitor.close();
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "지오 소개 표시", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
});
test("unsafe links are explained and deleting a staged link requires confirmation without saving", async ({
  page,
}) => {
  await menus(page);
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT") writes++;
  });
  const dialog = await add(page, { href: "https://name:secret@example.com/" });
  await expect(dialog.getByRole("alert")).toContainText("로그인 정보가 없는");
  await dialog
    .getByLabel("링크 주소", { exact: true })
    .fill("https://example.com/safe");
  await dialog
    .getByRole("button", { name: "편집에 적용", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "지오 영상 링크 삭제", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "지오 영상 링크 삭제", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "지오 영상 링크 삭제", exact: true })
    .click();
  await expect(page.locator(".menu-edit-row")).toHaveCount(6);
  await expect(
    page.getByRole("button", { name: "메뉴 저장", exact: true }),
  ).toBeDisabled();
  expect(writes).toBe(0);
  await expect(
    page.getByRole("switch", { name: "홈 표시", exact: true }),
  ).toBeDisabled();
});
test("concurrent settings preserve local edits until explicit reload and prevent a stale overwrite", async ({
  page,
}) => {
  await menus(page);
  await page
    .getByRole("switch", { name: "지오 소개 표시", exact: true })
    .click();
  const current = await (
    await page.request.get("/api/admin/navigation")
  ).json();
  const newer = current.items.map((item) =>
    item.id === "home" ? { ...item, label: "다른 곳에서 바꾼 홈" } : item,
  );
  expect(
    (
      await page.request.put("/api/admin/navigation", {
        headers: await headers(page),
        data: { items: newer, expected_revision: current.revision },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "메뉴 저장", exact: true }).click();
  await expect(page.locator("#menu-save-error")).toContainText("다른 관리자");
  await expect(
    page.getByRole("switch", { name: "지오 소개 표시", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
  await expect(
    page.getByRole("button", { name: "메뉴 저장", exact: true }),
  ).toBeDisabled();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "최신 설정 불러오기", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "지오 소개 표시", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
  page.once("dialog", (dialog) => dialog.accept());
  const reloadResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/admin/navigation") &&
      response.request().method() === "GET",
  );
  await page
    .getByRole("button", { name: "최신 설정 불러오기", exact: true })
    .click();
  expect((await reloadResponse).status()).toBe(200);
  await expect(
    page.getByRole("button", {
      name: "다른 곳에서 바꾼 홈 메뉴 수정",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "지오 소개 표시", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});
test("management design, accounts, menus and the link dialog fit all five target sizes", async ({
  page,
}) => {
  test.setTimeout(90000);
  await mkdir(".local/management-review/screenshots", { recursive: true });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(size);
    for (const [path, name] of [
      ["/admin", "management"],
      ["/admin/users", "accounts"],
      ["/admin/menus", "menus"],
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      if (name === "menus")
        await expect(page.locator(".menu-edit-row")).toHaveCount(6);
      if (name === "accounts")
        await expect(page.locator(".admin-account").first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path:
          ".local/management-review/screenshots/" +
          size.width +
          "-" +
          name +
          ".png",
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "새 링크 추가", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "새 링크 추가",
      exact: true,
    });
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test("unsaved menu edits survive reload as a versioned draft and navigation confirms discard", async ({
  page,
}) => {
  await menus(page);
  await page
    .getByRole("switch", { name: "지오 소개 표시", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .locator(".management-breadcrumb")
    .getByRole("link", { name: "관리", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/menus$/);
  const acceptReload = (dialog) => dialog.accept();
  page.on("dialog", acceptReload);
  await page.reload();
  page.off("dialog", acceptReload);
  await expect(
    page.getByRole("button", { name: "초안 복구", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "지오 소개 표시", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "초안 복구", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "지오 소개 표시", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
  await expect(
    page.getByRole("button", { name: "메뉴 저장", exact: true }),
  ).toBeEnabled();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator(".management-breadcrumb")
    .getByRole("link", { name: "관리", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
  await page
    .getByRole("navigation", { name: "관리 기능 선택" })
    .getByRole("link", { name: "메뉴 관리", exact: true })
    .click();
  await expect(page.locator(".menu-edit-row")).toHaveCount(6);
  await expect(
    page.getByRole("button", { name: "초안 복구", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("switch", { name: "지오 소개 표시", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "새 링크 추가", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "새 링크 추가",
    exact: true,
  });
  await dialog
    .getByLabel("메뉴 이름", { exact: true })
    .fill("아직 적용하지 않은 링크");
  const cancelledBack = page.waitForEvent("dialog");
  await page.evaluate(() => history.back());
  const cancelPrompt = await cancelledBack;
  expect(cancelPrompt.message()).toContain("저장하지 않은 메뉴 변경");
  await cancelPrompt.dismiss();
  await expect(page).toHaveURL(/\/admin\/menus$/);
  await expect(dialog.getByLabel("메뉴 이름", { exact: true })).toHaveValue(
    "아직 적용하지 않은 링크",
  );
  const acceptedBack = page.waitForEvent("dialog");
  await page.evaluate(() => history.back());
  await (await acceptedBack).accept();
  await expect(page).toHaveURL(/\/admin$/);
});
