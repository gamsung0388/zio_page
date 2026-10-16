import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
let credentials,
  created = [];
async function login(page) {
  await page.goto("/admin/login");
  await page
    .getByLabel("아이디", { exact: true })
    .fill(process.env.ZIO_E2E_USERNAME);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(process.env.ZIO_E2E_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  credentials = await (await page.request.get("/api/admin/me")).json();
}
async function create(page, extra = {}) {
  const response = await page.request.post("/api/admin/songs", {
    headers: {
      Origin: "http://127.0.0.1:5174",
      "X-CSRF-Token": credentials.csrfToken,
    },
    data: {
      title: "통합 검증 곡",
      artist: "화면 검증",
      description: "검증용 설명",
      genre: "발라드",
      language: "한국어",
      proficiency: 4,
      practice_status: "on_hold",
      balloon_cost: 15,
      memo: "HIDDEN_IN_PUBLIC",
      is_public: true,
      ...extra,
    },
  });
  expect(response.status()).toBe(201);
  const song = await response.json();
  created.push(song.id);
  return song;
}
test.afterEach(async ({ page }) => {
  for (const id of created)
    await page.request.delete("/api/admin/songs/" + id, {
      headers: {
        Origin: "http://127.0.0.1:5174",
        "X-CSRF-Token": credentials.csrfToken,
      },
    });
  created = [];
});

test("save failure retains draft, prevents duplicate submission and confirms unsaved navigation", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/songs/new");
  const form = page.getByRole("form", { name: "노래 입력" });
  await form.getByLabel("곡명").fill("저장 실패 유지 검증");
  await form.getByLabel("아티스트").fill("검증 가수");
  await form.getByRole("button", { name: "숙련도 4단계 선택" }).click();
  await form.getByRole("radio", { name: "잠시 보류", exact: true }).check();
  let requests = 0,
    release;
  const blocked = new Promise((resolve) => (release = resolve));
  await page.route("**/api/admin/songs", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    requests++;
    await blocked;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "저장 연결 오류" } }),
    });
  });
  await form.getByRole("button", { name: "등록하기", exact: true }).click();
  await expect(
    form.getByRole("button", { name: "저장 중…", exact: true }),
  ).toBeDisabled();
  await expect(form.getByLabel("곡명")).toBeDisabled();
  await form.evaluate((el) => el.requestSubmit());
  release();
  await expect(form.getByRole("alert")).toContainText("저장 연결 오류");
  expect(requests).toBe(1);
  await expect(form.getByLabel("곡명")).toHaveValue("저장 실패 유지 검증");
  await expect(
    form.getByRole("radio", { name: "잠시 보류", exact: true }),
  ).toBeChecked();
  page.once("dialog", (dialog) => dialog.dismiss());
  await form.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/songs\/new$/);
  page.once("dialog", (dialog) => dialog.accept());
  await form.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/songs$/);
});

test("real UI at all five target sizes, persisted editor and accessible mobile navigation", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  const song = await create(page);
  await mkdir(".local/integration-review/screenshots", { recursive: true });
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(size);
    for (const [name, url] of [
      ["home", "/"],
      ["songs", "/songs"],
      ["detail", "/songs/" + song.id],
      ["new", "/admin/songs/new"],
      ["edit", "/admin/songs/" + song.id + "/edit"],
      ["accounts", "/admin"],
    ]) {
      await page.goto(url);
      await expect(page.locator("h1")).toBeVisible();
      if (name === "edit") {
        await expect(page.getByLabel("지오 메모")).toHaveValue(
          "HIDDEN_IN_PUBLIC",
        );
        await expect(
          page.getByRole("radio", { name: "잠시 보류", exact: true }),
        ).toBeChecked();
      }
      if (["home", "songs", "detail"].includes(name)) {
        await expect(page.locator("body")).not.toContainText(
          "HIDDEN_IN_PUBLIC",
        );
      }
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path:
          ".local/integration-review/screenshots/" +
          size.width +
          "-" +
          name +
          ".png",
        fullPage: true,
      });
    }
  }
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "메뉴 닫기", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".sidebar-soop")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "메뉴 열기", exact: true }),
  ).toBeFocused();
  expect(errors).toEqual([]);
});

test("server filters, balloon sorting, paging and URL restoration work in the new cards", async ({
  page,
}) => {
  await login(page);
  for (let index = 0; index < 22; index++)
    await create(page, {
      title: "필터 검증 " + String(index).padStart(2, "0"),
      artist: "필터 가수",
      proficiency: 3,
      practice_status: "practicing",
      balloon_cost: index,
    });
  await page.goto(
    "/songs?q=필터&proficiency=3&practice_status=practicing&genre=발라드&language=한국어&sort=balloon_asc",
  );
  await expect(page.locator(".song-card")).toHaveCount(20);
  await expect(page.locator(".song-card").first()).toHaveAttribute(
    "aria-label",
    "필터 검증 00",
  );
  await page.getByRole("button", { name: "다음", exact: false }).click();
  await expect(page.locator(".song-card")).toHaveCount(2);
  await page.reload();
  await expect(page.getByLabel("숙련도 필터")).toHaveValue("3");
  await page.locator(".song-card").first().click();
  await page
    .getByRole("button", { name: "목록으로 돌아가기", exact: false })
    .click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".song-card")).toHaveCount(2);
  const cover = page.locator(".song-card-art").first();
  await expect(cover).toHaveAttribute("loading", "lazy");
  await cover.evaluate((el) => {
    el.src = "/missing-cover-image.png";
  });
  await expect(cover).toHaveAttribute("src", "/images/covers/night.svg");
});
