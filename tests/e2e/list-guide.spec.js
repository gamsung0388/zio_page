import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test.use({ timezoneId: "America/Los_Angeles" });
let created = [];
async function login(page, go = true) {
  if (go) await page.goto("/admin/login");
  await page
    .getByLabel("아이디", { exact: true })
    .fill(process.env.ZIO_E2E_USERNAME);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(process.env.ZIO_E2E_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}
async function headers(page) {
  const auth = await (await page.request.get("/api/admin/me")).json();
  return { Origin: "http://127.0.0.1:5174", "X-CSRF-Token": auth.csrfToken };
}
test.beforeEach(async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
});
test.afterEach(async ({ page }) => {
  for (const id of created) {
    const response = await page.request.get("/api/admin/schedule-events/" + id);
    if (response.ok()) {
      const data = await response.json();
      await page.request.delete("/api/admin/schedule-events/" + id, {
        headers: await headers(page),
        data: { expected_revision: data.revision },
      });
    }
  }
  created = [];
});

test("list date picker feeds both registration actions and saves the chosen date in a different month", async ({
  page,
}) => {
  await page.goto("/admin/schedule?month=2028-03&view=list");
  const date = page.getByLabel("등록할 날짜", { exact: true });
  await expect(date).toHaveAttribute("type", "date");
  await date.fill("2028-03-25");
  await page.getByRole("button", { name: "새 일정 등록", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "새 일정 등록", exact: true });
  await expect(dialog.getByLabel("시작일", { exact: true })).toHaveValue(
    "2028-03-25",
  );
  await expect(dialog.getByLabel("종료일", { exact: true })).toHaveValue(
    "2028-03-25",
  );
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await date.fill("2028-04-09");
  await expect(page.locator(".event-registration-month-hint")).toBeVisible();
  await page
    .getByRole("button", { name: "선택한 날짜에 일정 등록", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "새 일정 등록", exact: true });
  await expect(dialog.getByLabel("시작일", { exact: true })).toHaveValue(
    "2028-04-09",
  );
  await dialog
    .getByLabel("일정 제목", { exact: true })
    .fill("목록에서 날짜를 고른 방송");
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/admin/schedule-events"),
  );
  await dialog.getByRole("button", { name: "일정 저장", exact: true }).click();
  const saved = await (await response).json();
  created.push(saved.id);
  expect(saved.start_date).toBe("2028-04-09");
  expect(saved.end_date).toBe("2028-04-09");
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/month=2028-04/);
  await expect(date).toHaveValue("2028-04-09");
  await expect(
    page.getByRole("button", {
      name: "목록에서 날짜를 고른 방송 일정 수정",
      exact: true,
    }),
  ).toBeVisible();
});

test("invalid list dates are explained and day-group and calendar shortcuts use their own clicked dates", async ({
  page,
}) => {
  const response = await page.request.post("/api/admin/schedule-events", {
    headers: await headers(page),
    data: {
      title: "날짜 묶음 방송",
      description: "",
      kind: "broadcast",
      time_mode: "timed",
      start_date: "2028-05-10",
      end_date: "2028-05-10",
      start_time: "20:00",
      end_time: "21:00",
    },
  });
  const saved = await response.json();
  created.push(saved.id);
  await page.goto("/admin/schedule?month=2028-05&view=list");
  const date = page.getByLabel("등록할 날짜", { exact: true });
  await date.fill("2028-06-24");
  await page
    .getByRole("button", { name: "2028-05-10 일정 추가", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "새 일정 등록", exact: true });
  await expect(dialog.getByLabel("시작일", { exact: true })).toHaveValue(
    "2028-05-10",
  );
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await date.fill("");
  await page.getByRole("button", { name: "새 일정 등록", exact: true }).click();
  await expect(date).toBeFocused();
  await expect(date).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText("등록할 날짜");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await date.fill("2028-05-12");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "달력 보기", exact: true }).click();
  await page
    .getByRole("button", { name: "2028-05-15 새 일정", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "새 일정 등록", exact: true });
  await expect(dialog.getByLabel("시작일", { exact: true })).toHaveValue(
    "2028-05-15",
  );
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
});

test("protected guide returns after login and preserves month, view, day and category when returning to the list", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto(
    "/admin/schedule/guide?month=2028-04&view=list&day=2028-04-10&kind=personal",
  );
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
  await login(page, false);
  await expect(page).toHaveURL(/\/admin\/schedule\/guide\?/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "일정 관리 사용 가이드",
  );
  await page.getByRole("button", { name: "백업·복구", exact: true }).click();
  await expect(page.locator("#guide-backup")).toBeFocused();
  await expect(page.locator("#guide-backup")).toBeInViewport();
  expect(
    (await page.locator("#guide-backup").boundingBox()).y,
  ).toBeGreaterThanOrEqual(70);
  await page
    .getByText("목록에서 날짜를 골랐는데 조회하는 달은 그대로예요.", {
      exact: true,
    })
    .click();
  await expect(
    page.getByText("등록할 날짜 선택과 목록을 조회하는 달 선택은 별개입니다.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "일정 목록으로", exact: true }).click();
  const url = new URL(page.url());
  expect(url.searchParams.get("month")).toBe("2028-04");
  expect(url.searchParams.get("view")).toBe("list");
  expect(url.searchParams.get("day")).toBe("2028-04-10");
  expect(url.searchParams.get("kind")).toBe("personal");
  await expect(page.getByLabel("등록할 날짜", { exact: true })).toHaveValue(
    "2028-04-10",
  );
});

test("guide performs no data writes and its menu, date registration and content fit all five sizes", async ({
  page,
}) => {
  test.setTimeout(120000);
  const writes = [],
    errors = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/api/") &&
      !["GET", "HEAD"].includes(request.method())
    )
      writes.push(request.method() + " " + new URL(request.url()).pathname);
  });
  page.on("pageerror", (err) => errors.push(err.message));
  await mkdir(".local/list-guide-review/screenshots", { recursive: true });
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/admin/schedule?month=2028-04&view=list");
    await page.getByLabel("등록할 날짜", { exact: true }).fill("2028-04-12");
    await expect(
      page
        .getByRole("navigation", { name: "일정 관리 메뉴" })
        .getByRole("link"),
    ).toHaveCount(5);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".calendar-panel")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await page.screenshot({
      path: ".local/list-guide-review/screenshots/" + size.width + "-list.png",
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "선택한 날짜에 일정 등록", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "새 일정 등록",
      exact: true,
    });
    await expect(dialog.getByLabel("시작일", { exact: true })).toHaveValue(
      "2028-04-12",
    );
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: ".local/list-guide-review/screenshots/" + size.width + "-form.png",
      fullPage: false,
      animations: "disabled",
    });
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await page.getByRole("link", { name: "사용 가이드", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "일정 관리 사용 가이드",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".local/list-guide-review/screenshots/" + size.width + "-guide.png",
      fullPage: true,
      animations: "disabled",
    });
  }
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
