import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
test.use({ timezoneId: "America/Los_Angeles" });
let created = [];
const base = "/admin/schedule?month=2027-01&view=calendar";
const payload = (extra = {}) => ({
  title: "기간 검증 방송",
  description: "",
  kind: "broadcast",
  time_mode: "timed",
  start_date: "2027-01-04",
  end_date: "2027-01-04",
  start_time: "20:00",
  end_time: "21:00",
  ...extra,
});
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
  const data = await (await page.request.get("/api/admin/me")).json();
  return { Origin: "http://127.0.0.1:5174", "X-CSRF-Token": data.csrfToken };
}
async function seed(page, extra = {}) {
  const response = await page.request.post("/api/admin/schedule-events", {
    headers: await headers(page),
    data: payload(extra),
  });
  expect(response.status()).toBe(201);
  const event = await response.json();
  created.push(event.id);
  return event;
}
async function saveUi(page, dialog) {
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/admin/schedule-events") &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "일정 저장", exact: true }).click();
  const data = await (await response).json();
  created.push(data.id);
  await expect(dialog).toHaveCount(0);
  return data;
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
test("time controls and independent events support two schedules on one day and deletion of one item", async ({
  page,
}) => {
  await page.goto(base);
  await page
    .getByRole("button", { name: "2027-01-04 새 일정", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "새 일정 등록", exact: true });
  await expect(dialog.getByLabel("시작 시간", { exact: true })).toHaveAttribute(
    "type",
    "time",
  );
  await dialog.getByLabel("일정 제목", { exact: true }).fill("노래 방송 A");
  await dialog.getByLabel("시작 시간", { exact: true }).fill("20:30");
  await dialog.getByLabel("종료 시간", { exact: true }).fill("21:30");
  const first = await saveUi(page, dialog);
  expect(first.starts_at).toBe("2027-01-04T11:30:00.000Z");
  await page
    .getByRole("button", { name: "2027-01-04 새 일정", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "새 일정 등록", exact: true });
  await dialog.getByLabel("일정 제목", { exact: true }).fill("게임 방송 B");
  await dialog.getByLabel("시작 시간", { exact: true }).fill("22:00");
  await dialog.getByLabel("종료 시간", { exact: true }).fill("23:00");
  await saveUi(page, dialog);
  const day = page.locator(".event-calendar-day").filter({
    has: page.getByRole("button", {
      name: "2027-01-04 새 일정",
      exact: true,
    }),
  });
  await expect(day.locator(".event-chip")).toHaveCount(2);
  await page.reload();
  await expect(day.locator(".event-chip")).toHaveCount(2);
  await day
    .getByRole("button", { name: "노래 방송 A 일정 수정", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "일정 수정", exact: true });
  const deleteButton = dialog.getByRole("button", {
    name: "이 일정 삭제",
    exact: true,
  });
  await expect(deleteButton).toBeVisible();
  await expect(dialog.locator(".event-editor-tools")).not.toHaveAttribute(
    "open",
    "",
  );
  let deleteRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "DELETE") deleteRequests++;
  });
  await deleteButton.click();
  let confirmation = page.getByRole("dialog", {
    name: "일정을 삭제할까요?",
    exact: true,
  });
  await expect(confirmation).toContainText("노래 방송 A");
  await confirmation.getByRole("button", { name: "취소", exact: true }).click();
  await expect(deleteButton).toBeFocused();
  await expect(dialog).toBeVisible();
  expect(deleteRequests).toBe(0);
  expect(
    (await page.request.get("/api/admin/schedule-events/" + first.id)).status(),
  ).toBe(200);
  await deleteButton.click();
  confirmation = page.getByRole("dialog", {
    name: "일정을 삭제할까요?",
    exact: true,
  });
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(size);
    expect(
      await confirmation.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await expect(
      confirmation.getByRole("button", { name: "삭제하기", exact: true }),
    ).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  expect(deleteRequests).toBe(0);
  await deleteButton.click();
  await confirmation
    .getByRole("button", { name: "삭제하기", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    day.getByRole("button", { name: "게임 방송 B 일정 수정", exact: true }),
  ).toBeVisible();
  await expect(day.locator(".event-chip")).toHaveCount(1);
});
test("date periods include all-day end dates and exclude a timed midnight end date", async ({
  page,
}) => {
  await page.goto(base + "&edit=new&date=2027-01-04");
  let dialog = page.getByRole("dialog", { name: "새 일정 등록", exact: true });
  await dialog.getByLabel("일정 제목", { exact: true }).fill("자정 종료");
  await dialog.getByLabel("시작 시간", { exact: true }).fill("23:00");
  await dialog.getByLabel("종료 시간", { exact: true }).fill("22:00");
  await dialog.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("늦어야");
  await dialog.getByLabel("종료일", { exact: true }).fill("2027-01-05");
  await dialog.getByLabel("종료 시간", { exact: true }).fill("00:00");
  await saveUi(page, dialog);
  const day = (date) =>
    page.locator(".event-calendar-day").filter({
      has: page.getByRole("button", { name: date + " 새 일정", exact: true }),
    });
  await expect(
    day("2027-01-04").getByRole("button", {
      name: "자정 종료 일정 수정",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    day("2027-01-05").getByRole("button", {
      name: "자정 종료 일정 수정",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "2027-01-06 새 일정", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "새 일정 등록", exact: true });
  await dialog.getByLabel("일정 제목", { exact: true }).fill("여러 날 휴방");
  await dialog.getByRole("radio", { name: "종일", exact: true }).check();
  await dialog.getByLabel("종료일", { exact: true }).fill("2027-01-08");
  await expect(dialog.getByLabel("시작 시간", { exact: true })).toHaveCount(0);
  await saveUi(page, dialog);
  const period = page.getByRole("button", {
    name: "여러 날 휴방 일정 수정",
    exact: true,
  });
  await expect(period).toBeVisible();
  await expect(period).toHaveAttribute("data-start", "2027-01-06");
  await expect(period).toHaveAttribute("data-end", "2027-01-08");
  await expect(period).toHaveCSS("grid-column", "3 / span 3");
});
test("stale per-event save shows a conflict and preserves the editor until explicit reload", async ({
  page,
}) => {
  const event = await seed(page);
  await page.goto(base + "&edit=" + event.id);
  const dialog = page.getByRole("dialog", { name: "일정 수정", exact: true });
  await dialog.getByLabel("일정 제목", { exact: true }).fill("내 편집 초안");
  expect(
    (
      await page.request.put("/api/admin/schedule-events/" + event.id, {
        headers: await headers(page),
        data: {
          ...payload({ title: "다른 관리자 변경" }),
          expected_revision: event.revision,
        },
      })
    ).ok(),
  ).toBe(true);
  await dialog.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("변경되거나 삭제");
  await expect(dialog.getByLabel("일정 제목", { exact: true })).toHaveValue(
    "내 편집 초안",
  );
  await dialog.getByText("백업·다시 불러오기", { exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await dialog
    .getByRole("button", { name: "저장된 일정 다시 불러오기", exact: true })
    .click();
  await expect(dialog.getByLabel("일정 제목", { exact: true })).toHaveValue(
    "다른 관리자 변경",
  );
});
test("incomplete and expired event drafts recover in the same selected event context", async ({
  page,
}) => {
  await page.goto(base + "&edit=new&date=2027-01-04");
  let dialog = page.getByRole("dialog", { name: "새 일정 등록", exact: true });
  await dialog.getByLabel("일정 제목", { exact: true }).fill("복구할 일정");
  await dialog.getByLabel("종료 시간", { exact: true }).fill("");
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole("button", { name: "초안 복구", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "새 일정 등록", exact: true });
  await expect(dialog.getByLabel("종료 시간", { exact: true })).toHaveValue("");
  await dialog.getByLabel("종료 시간", { exact: true }).fill("22:00");
  await page.route("**/api/admin/schedule-events", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "세션 만료" } }),
        })
      : route.continue(),
  );
  await dialog.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page).toHaveURL(/expired=1/);
  await login(page, false);
  await page.getByRole("button", { name: "초안 복구", exact: true }).click();
  await expect(page.getByLabel("일정 제목", { exact: true })).toHaveValue(
    "복구할 일정",
  );
  await expect(page.getByLabel("시작일", { exact: true })).toHaveValue(
    "2027-01-04",
  );
});
test("weekly image import stages selected events, excludes personal defaults and preserves unfilled notes", async ({
  page,
}) => {
  await seed(page, { title: "첫 노래 방송" });
  await seed(page, {
    title: "두 번째 게임",
    start_time: "22:00",
    end_time: "23:00",
  });
  await seed(page, {
    title: "개인 메모",
    kind: "personal",
    start_time: "18:00",
    end_time: "19:00",
  });
  await seed(page, {
    title: "이틀 휴방",
    kind: "off",
    time_mode: "all_day",
    start_date: "2027-01-05",
    end_date: "2027-01-06",
    start_time: "",
    end_time: "",
  });
  await page.goto("/admin/schedule/image?week=2027-01-04");
  await page
    .getByLabel("목요일 방송 내용", { exact: true })
    .fill("그대로 남을 메모");
  await page
    .getByRole("button", { name: "등록된 일정 가져오기", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "등록된 일정 가져오기",
    exact: true,
  });
  await expect(
    dialog.getByRole("checkbox", { name: /개인 메모/ }),
  ).not.toBeChecked();
  page.once("dialog", (dialog) => dialog.accept());
  await dialog
    .getByRole("button", { name: "선택 일정 채우기", exact: true })
    .click();
  await expect(
    page.getByLabel("월요일 방송 내용", { exact: true }),
  ).toHaveValue(/첫 노래 방송[\s\S]*두 번째 게임/);
  await expect(
    page.getByLabel("월요일 방송 내용", { exact: true }),
  ).not.toHaveValue(/개인 메모/);
  await expect(
    page.getByLabel("목요일 방송 내용", { exact: true }),
  ).toHaveValue("그대로 남을 메모");
  await expect(
    page.getByLabel("화요일 방송 내용", { exact: true }),
  ).toHaveValue("이틀 휴방");
  await expect(
    page.getByLabel("화요일 방송 시간", { exact: true }),
  ).toHaveValue("종일");
  expect(
    (await (await page.request.get("/api/admin/schedules/2027-01-04")).json())
      .revision,
  ).toBe(0);
});
test("individual event JSON backup can be validated and staged as a new event without automatic writes", async ({
  page,
}) => {
  await seed(page, { title: "백업할 일정", end_date: "2027-01-05" });
  await page.goto(base);
  await page.locator(".event-backup-tools summary").click();
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "전체 일정 백업", exact: true })
    .click();
  const file = await event,
    bytes = await readFile(await file.path());
  const data = JSON.parse(bytes);
  expect(data.format).toBe("zio-schedule-events");
  expect(data.events[0].start_time).toBe("20:00");
  expect(data.events[0].end_date).toBe("2027-01-05");
  await page.getByLabel("개별 일정 백업 파일", { exact: true }).setInputFiles({
    name: "events.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await page
    .getByRole("dialog", { name: "개별 일정 백업 가져오기", exact: true })
    .getByRole("button", { name: "새 일정으로 입력", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "새 일정 등록",
    exact: true,
  });
  await expect(editor.getByLabel("일정 제목", { exact: true })).toHaveValue(
    "백업할 일정",
  );
  expect(
    (
      await (
        await page.request.get(
          "/api/admin/schedule-events?from=2027-01-01&to=2027-01-31",
        )
      ).json()
    ).pagination.total,
  ).toBe(1);
  page.once("dialog", (dialog) => dialog.accept());
  await editor.getByRole("button", { name: "취소", exact: true }).click();
  await expect(editor).toHaveCount(0);
});
test("new calendar, event list and period form fit all five sizes", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page, {
    title: "반응형 여러 날 일정",
    end_date: "2027-01-06",
  });
  await mkdir(".local/event-review/screenshots", { recursive: true });
  await mkdir(".local/event-delete-review/screenshots", { recursive: true });
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/admin/schedule?month=2027-01");
    await expect(page.locator("h1")).toBeVisible();
    await page.getByRole("button", { name: "달력 보기", exact: true }).click();
    await expect(page.locator(".event-calendar-day")).toHaveCount(42);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".local/event-review/screenshots/" + size.width + "-calendar.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "일정 목록", exact: true }).click();
    await expect(page.locator(".schedule-event-card")).toHaveCount(1);
    await page.screenshot({
      path: ".local/event-review/screenshots/" + size.width + "-list.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "새 일정 등록", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "새 일정 등록",
      exact: true,
    });
    await expect(dialog.getByLabel("시작 시간", { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "이 일정 삭제", exact: true }),
    ).toHaveCount(0);
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".local/event-review/screenshots/" + size.width + "-form.png",
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page
      .getByRole("button", {
        name: "반응형 여러 날 일정 일정 수정",
        exact: true,
      })
      .click();
    const editDialog = page.getByRole("dialog", {
      name: "일정 수정",
      exact: true,
    });
    await expect(
      editDialog.getByRole("button", { name: "이 일정 삭제", exact: true }),
    ).toBeVisible();
    expect(
      await editDialog
        .locator(".event-form-footer button")
        .evaluateAll((buttons) =>
          buttons.every((button) => {
            const rect = button.getBoundingClientRect();
            return (
              rect.top >= 0 && rect.bottom <= innerHeight && rect.height >= 44
            );
          }),
        ),
    ).toBe(true);
    expect(
      await editDialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path:
        ".local/event-delete-review/screenshots/" +
        size.width +
        "-edit-dialog.png",
      fullPage: false,
    });
    await editDialog.getByRole("button", { name: "취소", exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test("saving outside the current month follows the event and save-to-image opens event selection", async ({
  page,
}) => {
  await page.goto(base + "&edit=new&date=2027-01-04");
  let dialog = page.getByRole("dialog", { name: "새 일정 등록", exact: true });
  await dialog.getByLabel("일정 제목", { exact: true }).fill("다른 달로 이동");
  await dialog.getByLabel("시작일", { exact: true }).fill("2027-02-01");
  await saveUi(page, dialog);
  await expect(page).toHaveURL(/month=2027-02/);
  await expect(
    page.getByRole("button", { name: "다른 달로 이동 일정 수정", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "2027-02-02 새 일정", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "새 일정 등록", exact: true });
  await dialog
    .getByLabel("일정 제목", { exact: true })
    .fill("이미지로 가져올 일정");
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/admin/schedule-events") &&
      response.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "저장하고 이미지 만들기", exact: true })
    .click();
  created.push((await (await response).json()).id);
  await expect(page).toHaveURL(
    /\/admin\/schedule\/image\?week=2027-02-01&events=1/,
  );
  const selection = page.getByRole("dialog", {
    name: "등록된 일정 가져오기",
    exact: true,
  });
  await expect(
    selection.getByRole("checkbox", { name: /이미지로 가져올 일정/ }),
  ).toBeChecked();
  page.once("dialog", (dialog) => dialog.accept());
  await selection
    .getByRole("button", { name: "선택 일정 채우기", exact: true })
    .click();
  await expect(
    page.getByLabel("화요일 방송 내용", { exact: true }),
  ).toHaveValue("이미지로 가져올 일정");
});

test("mobile form keeps save actions visible and both actions focus invalid input before an overnight save", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(base + "&edit=new&date=2027-01-04");
  const dialog = page.getByRole("dialog", {
    name: "새 일정 등록",
    exact: true,
  });
  const title = dialog.getByLabel("일정 제목", { exact: true });
  await expect(title).toBeFocused();
  const save = dialog.getByRole("button", { name: "일정 저장", exact: true });
  const inside = async (locator) =>
    locator.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= innerHeight;
    });
  expect(await inside(save)).toBe(true);
  await dialog
    .getByRole("button", { name: "저장하고 이미지 만들기", exact: true })
    .click();
  await expect(title).toBeFocused();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByRole("alert")).toContainText("일정 제목");
  await title.fill("밤샘 노래 방송");
  await dialog.getByLabel("시작 시간", { exact: true }).fill("23:00");
  await dialog.getByLabel("종료 시간", { exact: true }).fill("01:00");
  await save.click();
  await expect(dialog.getByLabel("종료 시간", { exact: true })).toBeFocused();
  await dialog
    .getByRole("button", { name: "종료일을 다음 날로", exact: true })
    .click();
  await expect(dialog.getByLabel("종료일", { exact: true })).toHaveValue(
    "2027-01-05",
  );
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(dialog.locator(".event-duration-summary")).toContainText(
    "총 2시간",
  );
  await dialog.locator(".event-form-body").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  expect(await inside(save)).toBe(true);
  await dialog
    .getByRole("textbox", { name: /일정 메모/ })
    .fill("메모 ".repeat(150));
  expect(await inside(save)).toBe(true);
  const saved = await saveUi(page, dialog);
  expect(saved.end_date).toBe("2027-01-05");
});

test("new event uses the viewed month and category and a changed category remains visible after save", async ({
  page,
}) => {
  await page.goto("/admin/schedule?month=2027-03&kind=personal&view=list");
  await expect(
    page.getByRole("heading", { name: "개인 일정이 없어요", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "이 날짜에 일정 등록", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "새 일정 등록",
    exact: true,
  });
  await expect(dialog.getByLabel("시작일", { exact: true })).toHaveValue(
    "2027-03-01",
  );
  await expect(dialog.getByLabel("일정 구분", { exact: true })).toHaveValue(
    "personal",
  );
  await dialog
    .getByLabel("일정 제목", { exact: true })
    .fill("필터에 가려지지 않는 방송");
  await dialog
    .getByLabel("일정 구분", { exact: true })
    .selectOption("broadcast");
  await saveUi(page, dialog);
  await expect(
    page.getByRole("button", {
      name: "필터에 가려지지 않는 방송 일정 수정",
      exact: true,
    }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.has("kind")).toBe(false);
  await expect(
    page.getByRole("status").filter({ hasText: "전체 구분으로" }),
  ).toBeVisible();
});

test("day drilldown survives refresh and grouped list labels ongoing periods without duplicating events", async ({
  page,
}) => {
  for (let index = 0; index < 4; index++)
    await seed(page, { title: "날짜별 방송 " + index });
  await seed(page, {
    title: "지난달부터 진행",
    start_date: "2026-12-31",
    end_date: "2027-01-02",
  });
  await page.goto(base);
  const day = page.locator(".event-calendar-day").filter({
    has: page.getByRole("button", {
      name: "2027-01-04 새 일정",
      exact: true,
    }),
  });
  await day.getByRole("button", { name: "＋1개 더 보기", exact: true }).click();
  await expect(page).toHaveURL(/day=2027-01-04/);
  await expect(page.locator(".schedule-event-card")).toHaveCount(4);
  await page.reload();
  await expect(page.locator(".schedule-event-card")).toHaveCount(4);
  await expect(page.locator(".event-day-filter")).toContainText("1월 4일");
  await page.getByRole("button", { name: "월 전체 보기", exact: true }).click();
  await expect(page.locator(".schedule-event-card")).toHaveCount(5);
  await expect(page.locator(".event-date-group")).toHaveCount(2);
  await expect(page.locator(".event-date-group").first()).toContainText(
    "이전 날짜부터 이어지는 일정",
  );
  await page.getByLabel("일정 구분", { exact: true }).selectOption("off");
  await expect(
    page.getByRole("heading", { name: "휴방 일정이 없어요", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "전체 구분 보기", exact: true })
    .click();
  await expect(page.locator(".schedule-event-card")).toHaveCount(5);
});

test("keyboard Escape preserves edited inputs when cancelled and restores focus after closing", async ({
  page,
}) => {
  await page.goto(base);
  const trigger = page.getByRole("button", {
    name: "새 일정 등록",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "새 일정 등록",
    exact: true,
  });
  const title = dialog.getByLabel("일정 제목", { exact: true });
  await expect(title).toBeFocused();
  await title.fill("키보드 편집");
  await Promise.all([
    page.waitForEvent("dialog").then((prompt) => prompt.dismiss()),
    page.keyboard.press("Escape"),
  ]);
  await expect(dialog).toBeVisible();
  await expect(title).toHaveValue("키보드 편집");
  await Promise.all([
    page.waitForEvent("dialog").then((prompt) => prompt.accept()),
    page.keyboard.press("Escape"),
  ]);
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
