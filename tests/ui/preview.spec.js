import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const sizes = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
  { name: "360", width: 360, height: 800 },
];
const routes = [
  ["home", ""],
  ["songs", "songs"],
  ["detail", "songs/demo-001"],
  ["new", "songs/new"],
  ["edit", "songs/demo-001/edit"],
];
for (const size of sizes) {
  test(
    "five UI screens at " + size.width + "x" + size.height,
    async ({ page }) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize(size);
      await mkdir(".local/ui-review/screenshots", { recursive: true });
      for (const [name, route] of routes) {
        await page.goto("/ui-preview.html#/" + route);
        await expect(page.locator("h1")).toBeVisible();
        await expect(page.locator(".preview-banner")).toContainText(
          "UI 미리보기",
        );
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const broken = await page
          .locator("img")
          .evaluateAll((images) =>
            images
              .filter((img) => img.complete && img.naturalWidth === 0)
              .map((img) => img.src),
          );
        expect(broken).toEqual([]);
        await page.screenshot({
          path:
            ".local/ui-review/screenshots/" + size.name + "-" + name + ".png",
          fullPage: true,
        });
      }
      expect(errors).toEqual([]);
    },
  );
}
test("preview search, public separation, shared editor and mobile menu without API requests", async ({
  page,
}) => {
  const apiRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.goto("/ui-preview.html#/songs");
  await page.getByRole("searchbox").fill("검색결과가없어야합니다");
  await expect(page.getByText("검색 결과가 없어요")).toBeVisible();
  await page.getByRole("button", { name: "필터 초기화", exact: true }).click();
  await page.locator(".song-card").filter({ hasText: "밤하늘의 별을" }).click();
  await expect(page.locator("h1")).toContainText("밤하늘의 별을");
  await expect(
    page.getByRole("button", { name: "✎ 수정하기", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("후렴 부분 음정과 호흡");
  await page.goto("/ui-preview.html#/manage");
  await page
    .getByRole("button", { name: "＋ 곡 등록하기", exact: true })
    .click();
  await page.getByLabel("곡명", { exact: false }).fill("화면 확인용 QA 곡");
  await page.getByLabel("아티스트", { exact: false }).fill("UI QA");
  await page.getByRole("button", { name: "등록하기", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("숙련도");
  await page
    .getByRole("button", { name: "숙련도 4단계 선택", exact: true })
    .click();
  await page
    .locator(".segment-group label")
    .filter({ hasText: "잠시 보류" })
    .click();
  await page.getByLabel("신청 풍 개수", { exact: false }).fill("7");
  await page
    .getByLabel("지오 메모", { exact: false })
    .fill("UI_REVIEW_PRIVATE");
  await page.getByLabel("공개 상태", { exact: true }).selectOption("false");
  await page.getByRole("button", { name: "등록하기", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("화면 확인용 QA 곡");
  await expect(page.locator("body")).not.toContainText("UI_REVIEW_PRIVATE");
  await page.getByRole("button", { name: "✎ 수정하기", exact: true }).click();
  await expect(page.getByLabel("지오 메모", { exact: false })).toHaveValue(
    "UI_REVIEW_PRIVATE",
  );
  await page
    .getByRole("button", { name: "숙련도 5단계 선택", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "잠시 보류", exact: true }),
  ).toBeChecked();
  await page.getByLabel("곡명", { exact: false }).fill("수정한 QA 곡");
  await page.getByRole("button", { name: "수정하기", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("수정한 QA 곡");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "메뉴 패널", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".app-main")).toHaveAttribute("inert", "");
  await expect(
    page.getByRole("button", { name: "메뉴 닫기", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".sidebar-soop")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "메뉴 열기", exact: true }),
  ).toBeFocused();
  const privateHash = new URL(page.url()).hash;
  await page.evaluate(() => (location.hash = "#/songs"));
  await expect(page.locator("h1")).toContainText("노래책자");
  await expect(
    page.locator(".song-card").filter({ hasText: "수정한 QA 곡" }),
  ).toHaveCount(0);
  await page.evaluate((hash) => (location.hash = hash), privateHash);
  await expect(page.locator("h1")).toContainText("페이지를 찾을 수 없어요");
  expect(apiRequests).toEqual([]);
});
