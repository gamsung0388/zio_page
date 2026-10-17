import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const week = "2027-01-04",
  path = "/admin/schedule/image?week=" + week;
async function login(page, goto = true) {
  if (goto) await page.goto("/admin/login");
  await page
    .getByLabel("아이디", { exact: true })
    .fill(process.env.ZIO_E2E_USERNAME);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(process.env.ZIO_E2E_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}
async function clearWeek(page, date = week) {
  const auth = await (await page.request.get("/api/admin/me")).json(),
    data = await (
      await page.request.get("/api/admin/schedules/" + date)
    ).json();
  for (const day of Object.values(data.scheduleForm)) {
    day.content = "";
    day.time = "";
  }
  data.editorOptions.contentFontSize = 25;
  data.editorOptions.timeFontSize = 25;
  const { selectedTemplate, scheduleForm, editorOptions, revision } = data;
  expect(
    (
      await page.request.put("/api/admin/schedules/" + date, {
        headers: {
          Origin: "http://127.0.0.1:5174",
          "X-CSRF-Token": auth.csrfToken,
        },
        data: {
          selectedTemplate,
          scheduleForm,
          editorOptions,
          expected_revision: revision,
        },
      })
    ).ok(),
  ).toBe(true);
}
test.beforeEach(async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
  await clearWeek(page);
});
test("login returns to intended week; cancelled native date change and active tab keep the same week", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto(path);
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
  await login(page, false);
  await expect(page).toHaveURL(path);
  await page.getByLabel("월요일 내용", { exact: true }).fill("이동 취소 초안");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByLabel("주 선택", { exact: true }).fill("2027-02-01");
  await page.getByLabel("주 선택", { exact: true }).press("Tab");
  await expect(page).toHaveURL(path);
  await expect(page.getByLabel("주 선택", { exact: true })).toHaveValue(week);
  await expect(page.locator(".schedule-week-picker")).toContainText(
    "2027. 01. 04 ~ 2027. 01. 10",
  );
  await page
    .getByRole("navigation", { name: "일정 관리 메뉴" })
    .getByRole("link", { name: "스케줄 이미지", exact: true })
    .click();
  await expect(page).toHaveURL(path);
  await expect(page.getByLabel("월요일 내용", { exact: true })).toHaveValue(
    "이동 취소 초안",
  );
});
test("schedule session expiration returns to its week and restores its private draft", async ({
  page,
}) => {
  await page.goto(path);
  await page
    .getByLabel("월요일 내용", { exact: true })
    .fill("세션 만료 뒤 복구할 내용");
  await page.route("**/api/admin/schedules/" + week, (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "세션 만료" } }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page).toHaveURL(/expired=1/);
  await page.unroute("**/api/admin/schedules/" + week);
  await login(page, false);
  await expect(page).toHaveURL(path);
  await page.getByRole("button", { name: "초안 복구", exact: true }).click();
  await expect(page.getByLabel("월요일 내용", { exact: true })).toHaveValue(
    "세션 만료 뒤 복구할 내용",
  );
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page.locator(".schedule-save-state")).toContainText("저장 완료");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "초안 복구", exact: true }),
  ).toHaveCount(0);
});
test("song expiration restores incomplete fields and private memo; logout can be cancelled", async ({
  page,
}) => {
  await page.goto("/admin/songs/new");
  await page.getByLabel("곡명").fill("노래 초안 복구");
  await page.getByLabel("아티스트").fill("검증");
  await page.getByLabel("지오 메모").fill("PRIVATE_RECOVERY_ONLY");
  await page
    .getByRole("button", { name: "숙련도 3단계 선택", exact: true })
    .click();
  await page.route("**/api/admin/songs", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "세션 만료" } }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "등록하기", exact: true }).click();
  await expect(page).toHaveURL(/expired=1/);
  await login(page, false);
  await expect(page).toHaveURL(/\/admin\/songs\/new$/);
  await page.getByRole("button", { name: "초안 복구", exact: true }).click();
  await expect(page.getByLabel("지오 메모")).toHaveValue(
    "PRIVATE_RECOVERY_ONLY",
  );
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/songs\/new$/);
  await expect(page.getByLabel("곡명")).toHaveValue("노래 초안 복구");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await login(page, false);
  await page.goto("/admin/songs/new");
  await expect(
    page.getByRole("button", { name: "초안 복구", exact: true }),
  ).toHaveCount(0);
});
test("day modal reopens and restores its draft after an expired save", async ({
  page,
}) => {
  await page.goto("/admin/schedule/notes?month=2027-01");
  await page
    .getByRole("button", { name: "2027-01-06 일정 편집", exact: true })
    .click();
  await page.getByLabel("방송 내용", { exact: true }).fill("수요일 초안");
  await expect(page).toHaveURL(/day=2027-01-06/);
  await page.route("**/api/admin/schedules/" + week, (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "세션 만료" } }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page).toHaveURL(/expired=1/);
  await login(page, false);
  await page.getByRole("button", { name: "초안 복구", exact: true }).click();
  await expect(page.getByLabel("방송 내용", { exact: true })).toHaveValue(
    "수요일 초안",
  );
});
test("overflow blocks downloads; fitting resolves safe text and errors have an alert", async ({
  page,
}) => {
  await page.goto(path);
  let downloads = 0;
  page.on("download", () => downloads++);
  await page
    .getByLabel("월요일 내용", { exact: true })
    .fill(Array(12).fill("여러 줄 글자").join("\n"));
  await page.getByRole("button", { name: "PNG 저장", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("월요일 내용");
  expect(downloads).toBe(0);
  await page
    .getByRole("button", { name: "글자 자동 맞춤", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("최소 글자 크기");
  expect(downloads).toBe(0);
  await page
    .getByLabel("월요일 내용", { exact: true })
    .fill("첫째 줄\n둘째 줄");
  await page
    .getByRole("button", { name: "글자 자동 맞춤", exact: true })
    .click();
  await expect(page.locator(".schedule-export-notice")).toContainText(
    "맞췄어요",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG 저장", exact: true }).click();
  const file = await download;
  const bytes = await readFile(await file.path());
  expect(bytes.readUInt32BE(16)).toBe(1672);
  expect(bytes.readUInt32BE(20)).toBe(941);
  await page.route("**/api/admin/schedules/" + week, (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "저장 연결 오류" } }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("저장 연결 오류");
  await expect(page.getByLabel("월요일 내용", { exact: true })).toHaveValue(
    "첫째 줄\n둘째 줄",
  );
});
test("quick inputs, previous week copy and validated JSON import stay staged until save", async ({
  page,
}) => {
  await page.goto("/admin/schedule/image?week=2026-12-28");
  await page
    .getByLabel("월요일 내용", { exact: true })
    .fill("지난주 노래 방송");
  await page.getByRole("button", { name: "시간 미정", exact: true }).click();
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page.locator(".schedule-save-state")).toContainText("저장 완료");
  await page.goto(path);
  await page.locator(".schedule-backup-panel summary").click();
  await page
    .getByRole("button", { name: "지난주 가져오기", exact: true })
    .click();
  const copy = page.getByRole("dialog", { name: "지난주 일정 가져오기" });
  page.once("dialog", (dialog) => dialog.accept());
  await copy
    .getByRole("button", { name: "선택한 항목 가져오기", exact: true })
    .click();
  await expect(page.getByLabel("월요일 내용", { exact: true })).toHaveValue(
    "지난주 노래 방송",
  );
  expect(
    (await (await page.request.get("/api/admin/schedules/" + week)).json())
      .scheduleForm.mon.content,
  ).toBe("");
  await page.getByRole("button", { name: "휴방 입력", exact: true }).click();
  await expect(page.getByLabel("월요일 시간", { exact: true })).toHaveValue("");
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "현재 주 JSON 백업", exact: true })
    .click();
  const file = await event,
    bytes = await readFile(await file.path());
  const backup = JSON.parse(bytes);
  expect(backup.weeks[0].scheduleForm.mon.content).toBe("휴방");
  await page
    .getByLabel("월요일 내용", { exact: true })
    .fill("백업 전 다른 내용");
  await page.getByLabel("일정 백업 파일", { exact: true }).setInputFiles({
    name: "schedule.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  const restore = page.getByRole("dialog", { name: "백업에서 일정 가져오기" });
  page.once("dialog", (dialog) => dialog.accept());
  await restore
    .getByRole("button", { name: "현재 주에 가져오기", exact: true })
    .click();
  await expect(page.getByLabel("월요일 내용", { exact: true })).toHaveValue(
    "휴방",
  );
  await page.getByLabel("일정 백업 파일", { exact: true }).setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1,"weeks":[]}'),
  });
  await expect(page.getByRole("alert")).toContainText("백업 파일");
  await expect(page.getByLabel("월요일 내용", { exact: true })).toHaveValue(
    "휴방",
  );
  const all = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "전체 일정 JSON 백업", exact: true })
    .click();
  const allFile = await all;
  const allData = JSON.parse(await readFile(await allFile.path(), "utf8"));
  expect(allData.weeks.some((item) => item.week_start === "2026-12-28")).toBe(
    true,
  );
  expect(JSON.stringify(allData)).not.toContain("csrf");
});

test("another administrator cannot see a previous account draft in the same browser tab", async ({
  page,
}) => {
  const auth = await (await page.request.get("/api/admin/me")).json(),
    username = "qa-isolation-" + Date.now().toString(36),
    password = crypto.randomUUID();
  const response = await page.request.post("/api/admin/users", {
    headers: {
      Origin: "http://127.0.0.1:5174",
      "X-CSRF-Token": auth.csrfToken,
    },
    data: {
      username,
      display_name: "초안 격리 QA",
      password,
      password_confirmation: password,
    },
  });
  expect(response.ok()).toBe(true);
  await page.goto(path);
  await page
    .getByLabel("월요일 내용", { exact: true })
    .fill("첫 계정만 볼 수 있는 초안");
  await page.route("**/api/admin/schedules/" + week, (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "세션 만료" } }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page).toHaveURL(/expired=1/);
  await page.getByLabel("아이디", { exact: true }).fill(username);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(path);
  await expect(
    page.getByRole("button", { name: "초안 복구", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("월요일 내용", { exact: true })).toHaveValue("");
});
test("Korean midnight refreshes today without moving the selected month or erasing edits", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-31T14:59:58Z") });
  await page.goto("/admin/schedule/notes?month=2026-10");
  await expect(page.locator(".calendar-day.is-today")).toHaveAttribute(
    "aria-label",
    "2026-10-31 일정 편집",
  );
  await page.clock.fastForward(3000);
  await expect(page.locator(".calendar-day.is-today")).toHaveAttribute(
    "aria-label",
    "2026-11-01 일정 편집",
  );
  await expect(page).toHaveURL(/month=2026-10/);
  await page.getByRole("button", { name: "이번 달", exact: true }).click();
  await expect(page).toHaveURL(/month=2026-11/);
});

test("restored old schedule draft cannot overwrite a newer saved revision", async ({
  page,
}) => {
  await page.goto(path);
  await page.getByLabel("월요일 내용", { exact: true }).fill("이전 버전 초안");
  const auth = await (await page.request.get("/api/admin/me")).json(),
    data = await (
      await page.request.get("/api/admin/schedules/" + week)
    ).json();
  data.scheduleForm.mon.content = "최신 저장 내용";
  const { selectedTemplate, scheduleForm, editorOptions, revision } = data;
  expect(
    (
      await page.request.put("/api/admin/schedules/" + week, {
        headers: {
          Origin: "http://127.0.0.1:5174",
          "X-CSRF-Token": auth.csrfToken,
        },
        data: {
          selectedTemplate,
          scheduleForm,
          editorOptions,
          expected_revision: revision,
        },
      })
    ).ok(),
  ).toBe(true);
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole("button", { name: "초안 복구", exact: true }).click();
  await expect(page.getByLabel("월요일 내용", { exact: true })).toHaveValue(
    "이전 버전 초안",
  );
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("다른 관리자가");
  expect(
    (await (await page.request.get("/api/admin/schedules/" + week)).json())
      .scheduleForm.mon.content,
  ).toBe("최신 저장 내용");
});
test("confirmed logout clears drafts even when the session has already expired", async ({
  page,
}) => {
  await page.goto(path);
  await page
    .getByLabel("월요일 내용", { exact: true })
    .fill("로그아웃 시 버릴 초안");
  await page.route("**/api/admin/logout", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "세션 만료" } }),
    }),
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login(?:\?|$)/);
  await login(page, false);
  await page.goto(path);
  await expect(
    page.getByRole("button", { name: "초안 복구", exact: true }),
  ).toHaveCount(0);
});

test("unfinished song inputs recover after reload, including an empty balloon count", async ({
  page,
}) => {
  await page.goto("/admin/songs/new");
  await page.getByLabel("곡명").fill("입력 중인 곡");
  await page.getByLabel("신청 풍 개수").fill("");
  await page.getByLabel("지오 메모").fill("PRIVATE_INCOMPLETE_DRAFT");
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole("button", { name: "초안 복구", exact: true }).click();
  await expect(page.getByLabel("곡명")).toHaveValue("입력 중인 곡");
  await expect(page.getByLabel("신청 풍 개수")).toHaveValue("");
  await expect(page.getByLabel("지오 메모")).toHaveValue(
    "PRIVATE_INCOMPLETE_DRAFT",
  );
  await expect(page.getByLabel("아티스트")).toHaveValue("");
});
