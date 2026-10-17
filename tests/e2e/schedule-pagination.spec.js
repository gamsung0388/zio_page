import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  emptyEvent,
  validateEventPayload,
  eventFromRow,
} from "../../shared/schedule/events.js";
import { loginAdmin as login } from "./support/admin.js";
test.use({ timezoneId: "America/Los_Angeles" });
test.beforeEach(async ({ page }) => {
  await mkdir(".local/priority-review/screenshots", { recursive: true });
  await login(page);
});
function fixture(count) {
  return Array.from({ length: count }, (_, index) =>
    eventFromRow({
      ...validateEventPayload({
        ...emptyEvent("2032-06-15"),
        title: "페이지 일정 " + String(index + 1).padStart(4, "0"),
      }),
      id: index + 1,
      revision: 1,
    }),
  );
}
async function stubList(page, getEvents, requests) {
  await page.route("**/api/admin/schedule-events?**", async (route) => {
    expect(route.request().method()).toBe("GET");
    const params = new URL(route.request().url()).searchParams;
    requests.push(Object.fromEntries(params));
    const all = getEvents().filter(
      (event) => !params.get("kind") || params.get("kind") === event.kind,
    );
    const size = Number(params.get("page_size")),
      number = Number(params.get("page"));
    await route.fulfill({
      json: {
        items: all.slice((number - 1) * size, number * size),
        pagination: { page: number, page_size: size, total: all.length },
      },
    });
  });
}
test("schedule list loads one month page, preserves context through the guide and backs up the entire month", async ({
  page,
}) => {
  const requests = [],
    events = fixture(55);
  await stubList(page, () => events, requests);
  await page.goto("/admin/schedule?month=2032-06&view=list");
  await expect(page.locator(".schedule-event-card")).toHaveCount(50);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    from: "2032-06-01",
    to: "2032-06-30",
    page: "1",
    page_size: "50",
  });
  const pagination = page.getByRole("navigation", { name: "일정 목록 페이지" });
  await pagination.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.locator(".schedule-event-card")).toHaveCount(5);
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("link", { name: "사용 가이드", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("link", { name: "일정 목록으로", exact: true }).click();
  await expect(page.locator(".schedule-event-card")).toHaveCount(5);
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(size);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path:
        ".local/priority-review/screenshots/" + size.width + "-event-page.png",
      fullPage: true,
    });
  }
  await page.getByText("일정 백업과 가져오기", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "이번 달 일정 백업", exact: true })
    .click();
  const file = await download;
  const { readFile } = await import("node:fs/promises");
  const data = JSON.parse(await readFile(await file.path(), "utf8"));
  expect(data.events).toHaveLength(55);
  expect(requests.at(-1)).toMatchObject({
    from: "2032-06-01",
    to: "2032-06-30",
    page: "1",
    page_size: "200",
  });
  await page.getByRole("button", { name: "달력 보기", exact: true }).click();
  await expect(page.locator(".event-calendar-day")).toHaveCount(42);
  expect(requests.at(-1)).toMatchObject({
    from: "2032-05-31",
    to: "2032-07-11",
  });
  await page
    .locator(".event-calendar-day")
    .filter({
      has: page.getByRole("button", {
        name: "2032-06-15 새 일정",
        exact: true,
      }),
    })
    .getByRole("button", { name: "＋52개 더 보기", exact: true })
    .click();
  await expect(page).toHaveURL(/day=2032-06-15/);
  await expect(page.locator(".schedule-event-card")).toHaveCount(50);
  expect(requests.at(-1)).toMatchObject({
    from: "2032-06-15",
    to: "2032-06-15",
    page: "1",
    page_size: "50",
  });
  await page.goBack();
  await expect(page.locator(".event-calendar-day")).toHaveCount(42);
});

test("more than 2000 events remain reachable and invalid or emptied pages recover to a valid page", async ({
  page,
}) => {
  const requests = [];
  let events = fixture(2051);
  await stubList(page, () => events, requests);
  await page.route("**/api/admin/schedule-events/2051", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: events.at(-1) });
    expect(route.request().method()).toBe("DELETE");
    events = events.slice(0, -1);
    await route.fulfill({ json: { ok: true, id: 2051 } });
  });
  await page.goto("/admin/schedule?month=2032-06&view=list&page=9999");
  await expect(page).toHaveURL(/page=42/);
  await expect(page.locator(".schedule-event-card")).toHaveCount(1);
  expect(requests).toHaveLength(2);
  await page
    .getByRole("button", { name: "페이지 일정 2051 일정 수정", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "일정 수정", exact: true });
  await dialog.locator(".event-editor-tools summary").click();
  page.once("dialog", (dialog) => dialog.accept());
  await dialog
    .getByRole("button", { name: "이 일정 삭제", exact: true })
    .click();
  await expect(page).toHaveURL(/page=41/);
  await expect(page.locator(".schedule-event-card")).toHaveCount(50);
  await page
    .getByRole("combobox", { name: "일정 구분", exact: true })
    .selectOption("personal");
  await expect(page.locator(".schedule-event-empty")).toBeVisible();
  expect(requests.at(-1)).toMatchObject({
    page: "1",
    kind: "personal",
    page_size: "50",
  });
});

test("changing query during a delayed response keeps the latest list result and hides stale errors", async ({
  page,
}) => {
  const requests = [],
    events = fixture(1);
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let firstStarted;
  const started = new Promise((resolve) => (firstStarted = resolve));
  await page.route("**/api/admin/schedule-events?**", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(Object.fromEntries(params));
    if (params.get("kind") === "personal") {
      firstStarted();
      await gate;
      await route
        .fulfill({
          status: 503,
          json: { error: { message: "OLD_ERROR_SHOULD_NOT_APPEAR" } },
        })
        .catch(() => {});
    } else
      await route.fulfill({
        json: {
          items: events,
          pagination: { total: 1, page: 1, page_size: 50 },
        },
      });
  });
  await page.goto("/admin/schedule?month=2032-06&view=list");
  await expect(page.locator(".schedule-event-card")).toHaveCount(1);
  const select = page.getByRole("combobox", { name: "일정 구분", exact: true });
  await select.selectOption("personal");
  await started;
  await select.selectOption("broadcast");
  await expect(page.locator(".schedule-event-card")).toHaveCount(1);
  release();
  await expect(page.locator(".calendar-panel")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator("body")).not.toContainText(
    "OLD_ERROR_SHOULD_NOT_APPEAR",
  );
  expect(requests.at(-1).kind).toBe("broadcast");
});
