import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
const week = "2028-01-03",
  other = "2028-01-10";
async function headers(page) {
  const data = await (await page.request.get("/api/admin/me")).json();
  return { Origin: "http://127.0.0.1:5174", "X-CSRF-Token": data.csrfToken };
}
async function seed(page, date, title) {
  const current = await (
    await page.request.get("/api/admin/schedules/" + date)
  ).json();
  const response = await page.request.put("/api/admin/schedules/" + date, {
    headers: await headers(page),
    data: {
      selectedTemplate: current.selectedTemplate,
      editorOptions: current.editorOptions,
      scheduleForm: {
        ...current.scheduleForm,
        mon: { content: title, time: "20:00" },
        wed: { content: "수요일 메모", time: "22:00" },
      },
      expected_revision: current.revision,
    },
  });
  expect(response.ok()).toBe(true);
  return response.json();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/admin/login");
  await page
    .getByLabel("아이디", { exact: true })
    .fill(process.env.ZIO_E2E_USERNAME);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(process.env.ZIO_E2E_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await seed(page, week, "삭제 대상 메모");
  await seed(page, other, "보존할 다음 주");
});
test("saved-week list previews seven days, supports backup and cancel, and removes only the chosen week", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/schedule/notes?month=2028-01");
  const panel = page.getByRole("region", {
    name: "저장된 주간 메모",
    exact: true,
  });
  await expect(panel.locator(".saved-week-list li")).toHaveCount(2);
  await panel
    .getByRole("button", { name: week + " 주간 메모 삭제", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "주간 메모 삭제",
    exact: true,
  });
  await expect(
    dialog
      .getByRole("list", { name: "삭제할 주간 메모 내용" })
      .getByRole("listitem"),
  ).toHaveCount(7);
  await expect(dialog).toContainText("삭제 대상 메모");
  const download = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "삭제 전 JSON 백업", exact: true })
    .click();
  const file = await download;
  const data = JSON.parse(await readFile(await file.path(), "utf8"));
  expect(data.weeks[0].scheduleForm.mon.content).toBe("삭제 대상 메모");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(panel.locator(".saved-week-list li")).toHaveCount(2);
  await panel
    .getByRole("button", { name: week + " 주간 메모 삭제", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "주간 메모 삭제", exact: true });
  await mkdir(".local/week-delete-review", { recursive: true });
  await page.screenshot({
    path: ".local/week-delete-review/390-confirm.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "이 주 메모 삭제", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(panel.locator(".saved-week-list li")).toHaveCount(1);
  await expect(panel).toContainText(other);
  await page.reload();
  await expect(panel.locator(".saved-week-list li")).toHaveCount(1);
  const cleared = await (
    await page.request.get("/api/admin/schedules/" + week)
  ).json();
  expect(cleared.is_saved).toBe(false);
  expect(cleared.revision).toBeGreaterThan(0);
});
test("image editor deletes saved memo and explicitly discards working edits while individual events remain", async ({
  page,
}) => {
  const eventResponse = await page.request.post("/api/admin/schedule-events", {
    headers: await headers(page),
    data: {
      title: "유지할 개별 일정",
      description: "",
      kind: "broadcast",
      time_mode: "timed",
      start_date: week,
      end_date: week,
      start_time: "20:00",
      end_time: "21:00",
    },
  });
  expect(eventResponse.ok()).toBe(true);
  const event = await eventResponse.json();
  await page.goto("/admin/schedule/image?week=" + week);
  await page
    .getByLabel("월요일 방송 내용", { exact: true })
    .fill("아직 저장하지 않은 수정");
  await page
    .getByRole("button", { name: "이 주 저장 메모 삭제", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "주간 메모 삭제",
    exact: true,
  });
  await expect(dialog).toContainText(
    "현재 편집 중인 미저장 내용도 비워집니다.",
  );
  await expect(dialog).toContainText("삭제 대상 메모");
  await dialog
    .getByRole("button", { name: "이 주 메모 삭제", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByLabel("월요일 방송 내용", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "이 주 저장 메모 삭제", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".schedule-save-state")).toContainText(
    "아직 저장하지 않은 주",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "이 주 저장 메모 삭제", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "초안 복구", exact: true }),
  ).toHaveCount(0);
  expect(
    (await page.request.get("/api/admin/schedule-events/" + event.id)).status(),
  ).toBe(200);
  await page
    .getByLabel("월요일 방송 내용", { exact: true })
    .fill("삭제 후 다시 저장");
  await page.getByRole("button", { name: "일정 저장", exact: true }).click();
  await expect(page.locator(".schedule-export-notice")).toContainText(
    "일정을 저장했습니다",
  );
  expect(
    (await (await page.request.get("/api/admin/schedules/" + week)).json())
      .revision,
  ).toBeGreaterThan(2);
  await page.request.delete("/api/admin/schedule-events/" + event.id, {
    headers: await headers(page),
    data: { expected_revision: event.revision },
  });
});
test("a changed memo cannot be deleted from an old confirmation and both dialog sizes fit", async ({
  page,
}) => {
  await page.goto("/admin/schedule/image?week=" + week);
  await page
    .getByRole("button", { name: "이 주 저장 메모 삭제", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "주간 메모 삭제",
    exact: true,
  });
  for (const size of [
    { width: 1440, height: 900 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(size);
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await seed(page, week, "다른 관리자의 최신 메모");
  await dialog
    .getByRole("button", { name: "이 주 메모 삭제", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "변경되었거나 이미 삭제",
  );
  await expect(
    dialog.getByRole("button", { name: "이 주 메모 삭제", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(
    page.getByLabel("월요일 방송 내용", { exact: true }),
  ).toHaveValue("삭제 대상 메모");
  expect(
    (await (await page.request.get("/api/admin/schedules/" + week)).json())
      .scheduleForm.mon.content,
  ).toBe("다른 관리자의 최신 메모");
});
