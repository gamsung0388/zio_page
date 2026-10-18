import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { loginAdmin, adminHeaders } from "./support/admin.js";

const directory = ".local/song-guide-review/screenshots";

test("public song guide opens without login, explains real features and returns to the filtered list", async ({
  page,
}) => {
  const requests = [],
    writes = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/")) requests.push(path);
    if (path.startsWith("/api/") && !["GET", "HEAD"].includes(request.method()))
      writes.push(path);
  });
  const source =
    "/songs?q=%EA%B0%80%EC%88%98&proficiency=3&practice_status=practicing&sort=title_asc&page=1&page_size=50";
  await page.goto(source);
  await page.getByRole("link", { name: "사용 가이드", exact: true }).click();
  await expect(page).toHaveURL(/\/songs\/guide\?/);
  await expect(
    page.getByRole("heading", { level: 1, name: "노래책자 사용 가이드" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "숙련도·연습 상태", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#songs-level")).toBeFocused();
  await expect(page.locator("#songs-level")).toBeInViewport();
  expect(
    (await page.locator("#songs-level").boundingBox()).y,
  ).toBeGreaterThanOrEqual(70);
  await expect(page.getByLabel("숙련도 5/5", { exact: true })).toBeVisible();
  await page
    .getByText("로그인해야 노래책자를 볼 수 있나요?", { exact: true })
    .click();
  await expect(
    page.getByText("노래 검색과 상세 보기는 로그인 없이 이용할 수 있어요.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /등록 가이드|노래 등록·관리 가이드/ }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "노래책자로 돌아가기", exact: true })
    .first()
    .click();
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
    source,
  );
  expect(requests).not.toContain("/api/songs/guide");
  expect(writes).toEqual([]);
});

test("admin song guide requires login and restores its destination after authentication", async ({
  page,
}) => {
  const target =
    "/admin/songs/guide?returnTo=" +
    encodeURIComponent("/admin/songs?is_public=false&page=2");
  await page.goto(target);
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(target);
  await expect(
    page.getByRole("heading", { name: "노래 등록·관리 가이드", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("아이디", { exact: true })
    .fill(process.env.ZIO_E2E_USERNAME);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(process.env.ZIO_E2E_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/songs\/guide\?/);
  await expect(
    page.getByRole("heading", { name: "노래 등록·관리 가이드", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "CSV 일괄 등록", exact: true })
    .click();
  await expect(page.locator("#admin-song-csv")).toBeFocused();
  const table = page.getByRole("table");
  await expect(table).not.toBeVisible();
  await page.getByText("CSV 열과 입력값 자세히 보기", { exact: true }).click();
  await expect(table).toBeVisible();
  await expect(table).toContainText("practice_status");
  await page
    .getByRole("link", { name: "노래 관리로 돌아가기", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/songs\?is_public=false&page=1$/);
});

test("new and existing song editors open the guide in a new tab without losing or saving private inputs", async ({
  page,
}) => {
  await loginAdmin(page);
  const headers = await adminHeaders(page);
  const response = await page.request.post("/api/admin/songs", {
    headers,
    data: {
      title: "가이드 확인용 비공개 곡",
      artist: "검증 가수",
      proficiency: 3,
      is_public: false,
      memo: "GUIDE_PRIVATE_SENTINEL",
    },
  });
  expect(response.status()).toBe(201);
  const song = await response.json();
  try {
    const writes = [];
    page.context().on("request", (request) => {
      if (
        new URL(request.url()).pathname.startsWith("/api/") &&
        !["GET", "HEAD"].includes(request.method())
      )
        writes.push(request.method());
    });
    for (const path of ["/admin/songs/new", `/admin/songs/${song.id}/edit`]) {
      await page.goto(path);
      const form = page.getByRole("form", { name: "노래 입력" });
      await expect(
        form.getByRole("textbox", { name: "곡명", exact: true }),
      ).toBeVisible();
      await form
        .getByRole("textbox", { name: "곡명", exact: true })
        .fill("가이드를 봐도 유지할 제목");
      await form
        .getByRole("textbox", { name: "지오 메모", exact: true })
        .fill("GUIDE_UNSAVED_PRIVATE");
      const guide = page.getByRole("link", {
        name: "등록 가이드 (새 탭)",
        exact: true,
      });
      await expect(guide).toHaveAttribute("target", "_blank");
      const popupPromise = page.waitForEvent("popup");
      await guide.click();
      const popup = await popupPromise;
      await expect(
        popup.getByRole("heading", {
          name: "노래 등록·관리 가이드",
          exact: true,
        }),
      ).toBeVisible();
      expect(new URL(popup.url()).searchParams.get("returnTo")).toBe(path);
      await expect(popup.locator("body")).not.toContainText(
        "GUIDE_UNSAVED_PRIVATE",
      );
      await expect(popup.locator("body")).not.toContainText(
        "GUIDE_PRIVATE_SENTINEL",
      );
      await popup.close();
      await expect(
        form.getByRole("textbox", { name: "곡명", exact: true }),
      ).toHaveValue("가이드를 봐도 유지할 제목");
      await expect(
        form.getByRole("textbox", { name: "지오 메모", exact: true }),
      ).toHaveValue("GUIDE_UNSAVED_PRIVATE");
      page.once("dialog", (dialog) => dialog.accept());
      await form.getByRole("button", { name: "취소", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/songs$/);
    }
    expect(writes).toEqual([]);
    const stored = await (
      await page.request.get(`/api/admin/songs/${song.id}`)
    ).json();
    expect(stored.title).toBe(song.title);
    expect(stored.memo).toBe("GUIDE_PRIVATE_SENTINEL");
    expect((await page.request.get(`/api/songs/${song.id}`)).status()).toBe(
      404,
    );
  } finally {
    const stored = await (
      await page.request.get(`/api/admin/songs/${song.id}`)
    ).json();
    await page.request.delete(`/api/admin/songs/${song.id}`, {
      headers,
      data: { expected_revision: stored.revision },
    });
  }
});

test("guides and entry buttons fit all five screen sizes without API writes or page errors", async ({
  page,
}) => {
  test.setTimeout(150000);
  await loginAdmin(page);
  await mkdir(directory, { recursive: true });
  const errors = [],
    writes = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/api/") &&
      !["GET", "HEAD"].includes(request.method())
    )
      writes.push(request.method());
  });
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(size);
    for (const [name, path] of [
      ["public", "/songs/guide"],
      ["admin", "/admin/songs/guide"],
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page
          .locator(".reading-guide-toc button")
          .evaluateAll((buttons) =>
            buttons.every(
              (button) => button.getBoundingClientRect().height >= 44,
            ),
          ),
      ).toBe(true);
      await page.screenshot({
        path: `${directory}/${size.width}-${name}-guide.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
    await page.goto("/admin/songs");
    const manageGuide = page.getByRole("link", {
      name: "등록·관리 가이드",
      exact: true,
    });
    await expect(manageGuide).toBeVisible();
    expect((await manageGuide.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page
      .getByRole("button", { name: "새 노래 등록", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "등록 가이드 (새 탭)", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("heading", { name: /새 노래 등록/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${directory}/${size.width}-editor.png`,
      fullPage: false,
      animations: "disabled",
    });
  }
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
