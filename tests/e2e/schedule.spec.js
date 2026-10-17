import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const week = "2026-10-12";
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
}
async function reset(page) {
  const auth = await (await page.request.get("/api/admin/me")).json(),
    data = await (
      await page.request.get("/api/admin/schedules/" + week)
    ).json();
  for (const day of Object.values(data.scheduleForm)) {
    day.content = "";
    day.time = "";
  }
  const result = await page.request.put("/api/admin/schedules/" + week, {
    headers: {
      Origin: "http://127.0.0.1:5174",
      "X-CSRF-Token": auth.csrfToken,
    },
    data: {
      selectedTemplate: "images/schedule/zio-schedule-template.png",
      scheduleForm: data.scheduleForm,
      editorOptions: {
        contentFontSize: 25,
        timeFontSize: 25,
        textColor: "#1f3f18",
        bold: true,
        align: "left",
        hideColon: false,
      },
      expected_revision: data.revision,
    },
  });
  expect(result.ok()).toBe(true);
}
async function download(page, type = "PNG") {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: type + " 저장", exact: true }).click();
  const file = await event;
  return { file, bytes: await readFile(await file.path()) };
}
// Schedule tests represent a separate local client; retain the real production login throttles.
test.beforeEach(async ({ page }) => {
  await page
    .context()
    .setExtraHTTPHeaders({ "CF-Connecting-IP": "192.0.2.50" });
  await login(page);
  await reset(page);
});
test.afterEach(async ({ page }) => {
  await reset(page);
});

test("calendar persistence, shared image editor, clearing one date and administrator-only access", async ({
  page,
  context,
}) => {
  await page.goto("/admin/schedule/notes?month=2026-10");
  await page
    .getByRole("button", { name: "2026-10-14 일정 편집", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "2026-10-14 일정",
    exact: true,
  });
  await dialog
    .getByLabel("방송 내용", { exact: true })
    .fill("노래 방송\n함께해요");
  await dialog.getByLabel("시간 안내", { exact: true }).fill("20:30");
  await dialog.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "2026-10-14 일정 편집", exact: true }),
  ).toContainText("20:30");
  await page
    .getByRole("button", { name: "2026-10-14 일정 편집", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "저장하고 이미지 만들기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/schedule\/image\?week=2026-10-12$/);
  await expect(
    page.getByLabel("수요일 방송 내용", { exact: true }),
  ).toHaveValue("노래 방송\n함께해요");
  await page
    .getByLabel("월요일 방송 내용", { exact: true })
    .fill("월요일 추가");
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page.locator(".schedule-export-notice")).toContainText(
    "일정을 저장했습니다.",
  );
  await page.reload();
  await expect(
    page.getByLabel("월요일 방송 내용", { exact: true }),
  ).toHaveValue("월요일 추가");
  await page
    .getByRole("navigation", { name: "일정 관리 메뉴" })
    .getByRole("link", { name: "주간 이미지 메모", exact: true })
    .click();
  await page
    .getByRole("button", { name: "2026-10-14 일정 편집", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await dialog
    .getByRole("button", { name: "이 날짜 일정 비우기", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "2026-10-14 일정 편집", exact: true }),
  ).not.toContainText("20:30");
  await expect(
    page.getByRole("button", { name: "2026-10-12 일정 편집", exact: true }),
  ).toContainText("월요일 추가");
  const visitor = await context
    .browser()
    .newContext({ baseURL: "http://127.0.0.1:5174" });
  const anonymous = await visitor.newPage();
  await anonymous.goto("/");
  await expect(
    anonymous.getByRole("link", { name: "일정 관리", exact: true }),
  ).toHaveCount(0);
  await anonymous.goto("/admin/schedule/image");
  await expect(anonymous).toHaveURL(/\/admin\/login(?:\?|$)/);
  expect(
    (await anonymous.request.get("/api/admin/schedules/" + week)).status(),
  ).toBe(401);
  await visitor.close();
});

test("PNG and JPEG keep 1672x941 dimensions across desktop, mobile and zoom", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/admin/schedule/image?week=" + week);
  await page
    .getByLabel("월요일 방송 내용", { exact: true })
    .fill("첫 번째 줄\n두 번째 줄 🐼");
  await page.getByLabel("월요일 방송 시간", { exact: true }).fill("20:30");
  await page.locator(".schedule-design-details summary").click();
  await page.getByRole("button", { name: ": 제거", exact: true }).click();
  const desktop = await download(page);
  expect(desktop.bytes.readUInt32BE(16)).toBe(1672);
  expect(desktop.bytes.readUInt32BE(20)).toBe(941);
  expect(desktop.file.suggestedFilename()).toBe("zio-weekly-2026-10-12.png");
  await mkdir(".local/schedule-review", { recursive: true });
  await desktop.file.saveAs(".local/schedule-review/schedule.png");
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await download(page);
  expect(mobile.bytes.equals(desktop.bytes)).toBe(true);
  await page
    .getByRole("button", { name: "원본 크기로 보기", exact: true })
    .click();
  const zoom = await download(page);
  expect(zoom.bytes.equals(desktop.bytes)).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const jpeg = await download(page, "JPEG");
  expect(jpeg.bytes.subarray(0, 3).toString("hex")).toBe("ffd8ff");
  const size = await page.evaluate(async (data) => {
    const image = await createImageBitmap(
      await (await fetch("data:image/jpeg;base64," + data)).blob(),
    );
    return [image.width, image.height];
  }, jpeg.bytes.toString("base64"));
  expect(size).toEqual([1672, 941]);
});

test("eight templates export, failures recover and loading locks controls", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/admin/schedule/image?week=" + week);
  await page.locator(".schedule-design-details summary").click();
  await expect(page.getByLabel("템플릿", { exact: true })).toBeVisible();
  const hashes = new Set();
  for (let index = 1; index <= 8; index++) {
    await page
      .getByLabel("템플릿", { exact: true })
      .selectOption(
        "images/schedule/zio-schedule-template" +
          (index === 1 ? "" : index) +
          ".png",
      );
    const { bytes } = await download(page);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  expect(hashes.size).toBe(8);
  await page.route("**/images/schedule/zio-schedule-template2.png", (route) =>
    route.abort(),
  );
  await page
    .getByLabel("템플릿", { exact: true })
    .selectOption("images/schedule/zio-schedule-template2.png");
  await expect
    .poll(() =>
      page.locator(".schedule-template").evaluate((image) => image.complete),
    )
    .toBe(true);
  await page.getByRole("button", { name: "PNG 저장", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("불러오지 못했어요");
  await expect(page.getByLabel("템플릿", { exact: true })).toBeEnabled();
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route(
    "**/images/schedule/zio-schedule-template3.png",
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  await page
    .getByLabel("템플릿", { exact: true })
    .selectOption("images/schedule/zio-schedule-template3.png");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG 저장", exact: true }).click();
  await expect(
    page.getByLabel("월요일 방송 내용", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "일정 저장", exact: true }),
  ).toBeDisabled();
  release();
  await pending;
  await expect(page.getByLabel("템플릿", { exact: true })).toBeEnabled();
});

test("conflicting saves preserve the draft and unsaved navigation can be cancelled", async ({
  page,
}) => {
  await page.goto("/admin/schedule/image?week=" + week);
  await page
    .getByLabel("월요일 방송 내용", { exact: true })
    .fill("유지할 초안");
  const auth = await (await page.request.get("/api/admin/me")).json(),
    data = await (
      await page.request.get("/api/admin/schedules/" + week)
    ).json();
  data.scheduleForm.mon.content = "다른 관리자의 저장";
  const response = await page.request.put("/api/admin/schedules/" + week, {
    headers: {
      Origin: "http://127.0.0.1:5174",
      "X-CSRF-Token": auth.csrfToken,
    },
    data: {
      selectedTemplate: data.selectedTemplate,
      scheduleForm: data.scheduleForm,
      editorOptions: data.editorOptions,
      expected_revision: data.revision,
    },
  });
  expect(response.ok()).toBe(true);
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("다른 관리자가");
  await expect(
    page.getByLabel("월요일 방송 내용", { exact: true }),
  ).toHaveValue("유지할 초안");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "다음 주", exact: true }).click();
  await expect(page).toHaveURL(/week=2026-10-12$/);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "저장된 일정 불러오기", exact: true })
    .click();
  await expect(
    page.getByLabel("월요일 방송 내용", { exact: true }),
  ).toHaveValue("다른 관리자의 저장");
});

test("calendar, editor and day modal fit all five target sizes", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir(".local/schedule-review/screenshots", { recursive: true });
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(size);
    for (const [name, path] of [
      ["calendar", "/admin/schedule/notes?month=2026-10"],
      ["image", "/admin/schedule/image?week=" + week],
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      if (name === "calendar")
        await expect(page.locator(".calendar-day")).toHaveCount(42);
      else
        await expect(
          page.getByLabel("월요일 내용", { exact: true }),
        ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path:
          ".local/schedule-review/screenshots/" +
          size.width +
          "-" +
          name +
          ".png",
        fullPage: true,
      });
    }
    await page.goto("/admin/schedule/notes?month=2026-10");
    await page
      .getByRole("button", { name: "2026-10-14 일정 편집", exact: true })
      .click();
    const modal = page.getByRole("dialog", { name: "2026-10-14 일정" });
    await expect(modal.getByLabel("방송 내용", { exact: true })).toBeVisible();
    expect(
      await modal.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".local/schedule-review/screenshots/" + size.width + "-day.png",
      fullPage: true,
    });
    await modal.getByRole("button", { name: "취소", exact: true }).click();
  }
  expect(errors).toEqual([]);
});
