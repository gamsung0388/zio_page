import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { loginAdmin, adminHeaders } from "./support/admin.js";
const directory = ".local/stability-review/screenshots";
let prefix;
test.beforeEach(async ({ page }) => {
  prefix = "보완검증-" + randomUUID().slice(0, 8);
  await loginAdmin(page);
});
test.afterEach(async ({ page }) => {
  const headers = await adminHeaders(page);
  const list = await (
    await page.request.get(
      "/api/admin/songs?" +
        new URLSearchParams({ q: prefix, page_size: "100" }),
    )
  ).json();
  for (const song of list.items || [])
    await page.request.delete(`/api/admin/songs/${song.id}`, {
      headers,
      data: { expected_revision: song.revision },
    });
});
const csv = (rows) =>
  "title,artist,description,genre,language,proficiency,practice_status,balloon_cost,memo,is_public\r\n" +
  rows
    .map((row) =>
      [
        row.title,
        "검증 가수",
        "곡 설명",
        "발라드",
        "한국어",
        "3",
        "practicing",
        "10",
        "PRIVATE_STABILITY_MEMO",
        String(row.public ?? true),
      ].join(","),
    )
    .join("\r\n") +
  "\r\n";
async function seed(page, rows) {
  const headers = { ...(await adminHeaders(page)), "Content-Type": "text/csv" },
    body = csv(rows);
  const preview = await (
    await page.request.post("/api/admin/songs/import/preview", {
      headers,
      data: body,
    })
  ).json();
  const response = await page.request.post("/api/admin/songs/import", {
    headers: {
      ...headers,
      "Idempotency-Key": randomUUID(),
      "X-CSV-Preview": preview.preview_token,
      "X-CSV-Duplicates": "yes",
    },
    data: body,
  });
  expect(response.status()).toBe(200);
}

test("last filtered song visibility change and stale public page return to a valid page with filters intact", async ({
  page,
}) => {
  await seed(
    page,
    Array.from({ length: 21 }, (_, index) => ({ title: prefix + "-" + index })),
  );
  await page.goto(
    "/admin/songs?" +
      new URLSearchParams({
        q: prefix,
        is_public: "true",
        page: "2",
        page_size: "20",
        sort: "title_asc",
      }),
  );
  await page
    .getByRole("button", { name: new RegExp(prefix + ".* 비공개로 전환") })
    .click();
  await expect(page).toHaveURL(/page=1/);
  expect(new URL(page.url()).searchParams.get("q")).toBe(prefix);
  expect(new URL(page.url()).searchParams.get("is_public")).toBe("true");
  await expect(page.locator(".empty-notice")).toHaveCount(0);
  await expect(page.locator(".results-toolbar")).toContainText("20");
  await page.goto(
    "/songs?" +
      new URLSearchParams({
        q: prefix,
        page: "999",
        page_size: "20",
        sort: "title_asc",
      }),
  );
  await expect(page).toHaveURL(/page=1/);
  await expect(page.locator(".song-grid .song-card")).toHaveCount(20);
  await page
    .getByLabel("곡명 또는 가수 검색", { exact: true })
    .fill(prefix + "-no-match");
  await expect(
    page.getByRole("heading", {
      name: "검색 조건에 맞는 노래가 없어요",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "필터 초기화", exact: true }),
  ).toBeVisible();
});

test("desktop table and cards share actions, resize to mobile cards and switch without extra song API reads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, [
    { title: prefix + "공개" },
    { title: prefix + "비공개", public: false },
  ]);
  await page.goto("/admin/songs?q=" + prefix);
  const table = page.getByRole("table", {
    name: "노래 관리 목록",
    exact: true,
  });
  await expect(table).toBeVisible();
  await expect(table).not.toContainText("PRIVATE_STABILITY_MEMO");
  const reads = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/admin/songs")
      reads.push(request.url());
  });
  await page.getByRole("button", { name: "카드 보기", exact: true }).click();
  await expect(page.locator(".managed-song")).toHaveCount(2);
  await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await expect(table).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(table).toHaveCount(0);
  await expect(page.locator(".managed-song")).toHaveCount(2);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(table).toBeVisible();
  expect(reads).toEqual([]);
  await table
    .getByRole("button", { name: prefix + "공개 수정", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "곡명", exact: true }),
  ).toHaveValue(prefix + "공개");
});

test("public save notice and accessible tooltips keep unsaved values and fit all five screen sizes", async ({
  page,
}) => {
  test.setTimeout(120000);
  await mkdir(directory, { recursive: true });
  const errors = [],
    writes = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      request.url().includes("/api/") &&
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
    await page.goto("/admin/songs/new");
    await expect(
      page.getByRole("heading", { name: /새 노래 등록/ }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "곡명", exact: true })
      .fill("유지할 입력");
    await page
      .getByRole("textbox", { name: "지오 메모", exact: true })
      .fill("PRIVATE_UNSAVED_STABILITY");
    const help = page.getByRole("button", {
      name: "숙련도 도움말",
      exact: true,
    });
    await help.focus();
    await expect(page.getByRole("tooltip")).toContainText("1~5단계");
    let box = await page.getByRole("tooltip").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await help.click();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await help.click();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "공개 상태", exact: true })
      .selectOption("false");
    await expect(page.locator(".song-save-visibility")).toContainText(
      "관리자에게만 보여요",
    );
    await page
      .getByRole("button", { name: "등록하기", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(page.locator(".song-save-visibility")).toBeInViewport();
    await expect(
      page.getByRole("textbox", { name: "곡명", exact: true }),
    ).toHaveValue("유지할 입력");
    await expect(
      page.getByRole("textbox", { name: "지오 메모", exact: true }),
    ).toHaveValue("PRIVATE_UNSAVED_STABILITY");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${directory}/${size.width}-save-visibility.png`,
      fullPage: false,
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "취소", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/songs$/);
  }
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

for (const reopen of [false, true])
  test(`CSV lost response ${reopen ? "after reopening" : "on retry"} recovers the completed job without a duplicate`, async ({
    page,
  }) => {
    const body = csv([{ title: prefix + "재시도", public: false }]),
      keys = [];
    let lose = true;
    await page.route("**/api/admin/songs/import", async (route) => {
      keys.push(route.request().headers()["idempotency-key"]);
      if (lose) {
        lose = false;
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        await route.abort("connectionreset");
      } else await route.continue();
    });
    await page.goto("/admin/songs");
    async function select() {
      await page
        .getByRole("button", { name: "CSV 가져오기", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "CSV 일괄 등록", exact: true })
        .getByLabel("CSV 파일 선택", { exact: true })
        .setInputFiles({
          name: "retry.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(body),
        });
      await page
        .getByRole("button", { name: "미리보기 및 검증", exact: true })
        .click();
    }
    await select();
    await page
      .getByRole("button", { name: "1곡 추가하기", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    if (reopen) {
      await page
        .getByRole("dialog")
        .locator(".modal-actions")
        .getByRole("button", { name: "닫기", exact: true })
        .click();
      await select();
    } else
      await page
        .getByRole("button", { name: "1곡 추가하기", exact: true })
        .click();
    await expect(
      page.getByRole("dialog", { name: "CSV 일괄 등록", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        "1곡은 이미 추가되어 있어요. 중복으로 등록하지 않았습니다.",
        { exact: true },
      ),
    ).toBeVisible();
    const data = await (
      await page.request.get("/api/admin/songs?q=" + prefix)
    ).json();
    expect(data.pagination.total).toBe(1);
    if (!reopen) expect(keys[1]).toBe(keys[0]);
  });

test("CSV changes after preview show fresh warnings and require a new confirmation", async ({
  page,
}) => {
  const body = csv([{ title: prefix + "경합" }]);
  await page.goto("/admin/songs");
  await page.getByRole("button", { name: "CSV 가져오기", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "CSV 일괄 등록",
    exact: true,
  });
  await dialog.getByLabel("CSV 파일 선택", { exact: true }).setInputFiles({
    name: "race.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(body),
  });
  await dialog
    .getByRole("button", { name: "미리보기 및 검증", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "1곡 추가하기", exact: true }),
  ).toBeEnabled();
  await seed(page, [{ title: prefix + "경합" }]);
  await dialog
    .getByRole("button", { name: "1곡 추가하기", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("미리보기 이후");
  await expect(
    dialog.getByRole("button", { name: "1곡 추가하기", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "1곡 추가하기", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const result = await (
    await page.request.get("/api/admin/songs?q=" + prefix)
  ).json();
  expect(result.pagination.total).toBe(2);
});
