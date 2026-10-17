import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { loginAdmin, adminHeaders } from "./support/admin.js";
let created = [];
test.use({ timezoneId: "America/Los_Angeles" });
test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});
test.afterEach(async ({ page }) => {
  const headers = await adminHeaders(page);
  for (const id of created) {
    const response = await page.request.get("/api/admin/schedule-events/" + id);
    if (response.ok())
      await page.request.delete("/api/admin/schedule-events/" + id, {
        headers,
        data: { expected_revision: (await response.json()).revision },
      });
  }
  created = [];
});
async function seed(page, extra = {}) {
  const response = await page.request.post("/api/admin/schedule-events", {
    headers: await adminHeaders(page),
    data: {
      title: "이어지는 방송",
      description: "",
      kind: "broadcast",
      time_mode: "timed",
      start_date: "2026-10-17",
      end_date: "2026-10-30",
      start_time: "20:00",
      end_time: "22:00",
      ...extra,
    },
  });
  expect(response.status()).toBe(201);
  const event = await response.json();
  created.push(event.id);
  return event;
}
test("one event connects dates across three weeks and every segment opens the same saved record", async ({
  page,
}) => {
  const event = await seed(page);
  await page.goto("/admin/schedule?month=2026-10&view=calendar");
  const bars = page.locator(
    '.event-period-bar[data-event-id="' + event.id + '"]',
  );
  await expect(bars).toHaveCount(3);
  expect(
    await bars.evaluateAll((elements) =>
      elements.map((element) => [element.dataset.start, element.dataset.end]),
    ),
  ).toEqual([
    ["2026-10-17", "2026-10-18"],
    ["2026-10-19", "2026-10-25"],
    ["2026-10-26", "2026-10-30"],
  ]);
  await expect(bars.nth(0)).toHaveClass(/continues-after/);
  await expect(bars.nth(1)).toHaveClass(/continues-before/);
  await expect(bars.nth(1)).toHaveClass(/continues-after/);
  expect(
    await bars
      .nth(1)
      .evaluate(
        (element) =>
          Math.abs(
            element.getBoundingClientRect().width -
              element.closest(".event-calendar-week").getBoundingClientRect()
                .width,
          ) < 2,
      ),
  ).toBe(true);
  for (let index = 0; index < 3; index++) {
    await bars.nth(index).click();
    await expect(page).toHaveURL(new RegExp("edit=" + event.id));
    const dialog = page.getByRole("dialog", { name: "일정 수정", exact: true });
    await expect(dialog.getByLabel("시작일", { exact: true })).toHaveValue(
      "2026-10-17",
    );
    await expect(dialog.getByLabel("종료일", { exact: true })).toHaveValue(
      "2026-10-30",
    );
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
  }
});
test("overlapping periods occupy separate lanes and hidden events remain reachable through the day list", async ({
  page,
}) => {
  for (let index = 0; index < 4; index++)
    await seed(page, {
      title: "겹치는 일정 " + index,
      start_date: "2027-01-04",
      end_date: "2027-01-05",
    });
  await seed(page, {
    title: "하루 방송",
    start_date: "2027-01-04",
    end_date: "2027-01-04",
  });
  await page.goto("/admin/schedule?month=2027-01&view=calendar");
  const week = page.locator('.event-calendar-week[data-week="2027-01-04"]');
  await expect(week.locator(".event-period-bar")).toHaveCount(3);
  expect(
    await week
      .locator(".event-period-bar")
      .evaluateAll(
        (elements) =>
          new Set(
            elements.map((element) => getComputedStyle(element).gridRowStart),
          ).size,
      ),
  ).toBe(3);
  const day = week
    .locator(".event-calendar-day")
    .filter({
      has: page.getByRole("button", {
        name: "2027-01-04 새 일정",
        exact: true,
      }),
    });
  await day.getByRole("button", { name: "＋2개 더 보기", exact: true }).click();
  await expect(page).toHaveURL(/day=2027-01-04/);
  await expect(page.locator(".schedule-event-card")).toHaveCount(5);
});
test("midnight endings stop before the next date while inclusive all-day bars reach their final date", async ({
  page,
}) => {
  const midnight = await seed(page, {
    title: "자정 종료",
    start_date: "2027-01-04",
    end_date: "2027-01-06",
    start_time: "23:00",
    end_time: "00:00",
  });
  const allDay = await seed(page, {
    title: "종일 기간",
    start_date: "2027-01-04",
    end_date: "2027-01-06",
    time_mode: "all_day",
    start_time: "",
    end_time: "",
  });
  const single = await seed(page, {
    title: "다음날 자정",
    start_date: "2027-01-08",
    end_date: "2027-01-09",
    start_time: "23:00",
    end_time: "00:00",
  });
  await page.goto("/admin/schedule?month=2027-01&view=calendar");
  await expect(
    page.locator('.event-period-bar[data-event-id="' + midnight.id + '"]'),
  ).toHaveAttribute("data-end", "2027-01-05");
  await expect(
    page.locator('.event-period-bar[data-event-id="' + allDay.id + '"]'),
  ).toHaveAttribute("data-end", "2027-01-06");
  await expect(
    page.locator('.event-period-bar[data-event-id="' + single.id + '"]'),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".event-calendar-day")
      .filter({
        has: page.getByRole("button", {
          name: "2027-01-08 새 일정",
          exact: true,
        }),
      })
      .getByRole("button", { name: "다음날 자정 일정 수정", exact: true }),
  ).toBeVisible();
});
test("period bars, date buttons and overflow fit all five sizes without overlap or horizontal scrolling", async ({
  page,
}) => {
  test.setTimeout(90000);
  await seed(page, { title: "월말까지 이어지는 긴 제목의 노래 방송" });
  await seed(page, {
    title: "겹치는 합방",
    start_date: "2026-10-18",
    end_date: "2026-10-25",
    kind: "collab",
  });
  await seed(page, {
    title: "다음 달까지 이어지는 일정",
    start_date: "2026-10-23",
    end_date: "2026-11-04",
    kind: "other",
  });
  await page.goto("/admin/schedule?month=2026-10&view=calendar");
  await expect(page.locator(".event-calendar-day")).toHaveCount(42);
  await mkdir(".local/calendar-continuity-review/screenshots", {
    recursive: true,
  });
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
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const problems = await page
      .locator(".event-calendar-week")
      .evaluateAll((weeks) =>
        weeks.flatMap((week) => {
          const bounds = week.getBoundingClientRect(),
            bars = [...week.querySelectorAll(".event-period-bar")].map(
              (element) => element.getBoundingClientRect(),
            ),
            headers = [...week.querySelectorAll(".event-date-add")].map(
              (element) => element.getBoundingClientRect(),
            );
          const issues = [];
          for (let index = 0; index < bars.length; index++) {
            const bar = bars[index];
            if (
              bar.left < bounds.left - 1 ||
              bar.right > bounds.right + 1 ||
              bar.bottom > bounds.bottom + 1
            )
              issues.push("bar outside week");
            if (headers.some((header) => bar.top < header.bottom - 1))
              issues.push("bar covers date header");
            for (const other of bars.slice(index + 1))
              if (
                Math.min(bar.right, other.right) -
                  Math.max(bar.left, other.left) >
                  1 &&
                Math.min(bar.bottom, other.bottom) -
                  Math.max(bar.top, other.top) >
                  1
              )
                issues.push("bars overlap");
          }
          return issues;
        }),
      );
    expect(problems).toEqual([]);
    await page.screenshot({
      path:
        ".local/calendar-continuity-review/screenshots/" +
        size.width +
        "-calendar.png",
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 360, height: 800 });
  await page
    .getByRole("button", { name: "2026-10-20 새 일정", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("시작일", { exact: true }),
  ).toHaveValue("2026-10-20");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "취소", exact: true })
    .click();
});
