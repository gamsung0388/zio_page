import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test.describe.configure({ mode: "serial" });
const issues = [];
async function openAdminMenu(page, label) {
  if (new URL(page.url()).pathname !== "/admin") await page.goto("/admin");
  await expect(
    page.getByRole("button", { name: /비밀번호 초기화/ }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "관리 기능 선택", exact: true })
    .getByRole("link", {
      name: ["관리자 관리", "메뉴 관리"].includes(label)
        ? label
        : "관리자 관리",
      exact: true,
    })
    .click();
  if (!["관리자 관리", "메뉴 관리"].includes(label))
    await page
      .getByRole("navigation", { name: "관리자 메뉴", exact: true })
      .getByRole("link", { name: label, exact: true })
      .click();
}
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => issues.push(error.message));
});
test("home, empty state, 404 and protected admin routes", async ({ page }) => {
  await page.goto("/");
  await expect(
    page
      .getByRole("navigation", { name: "주 메뉴", exact: true })
      .getByRole("link", { name: "관리자 관리", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /지오의 작은\s*음악 공간/ }),
  ).toBeVisible();
  await expect(page.getByText("첫 번째 노래를 기다리고 있어요")).toBeVisible();
  await page.getByRole("link", { name: "노래책자 둘러보기" }).click();
  await expect(page).toHaveURL(/\/songs$/);
  await expect(page.getByText("아직 등록된 노래가 없어요")).toBeVisible();
  await page.goto("/admin/songs");
  await expect(page).toHaveURL(/\/admin\/login(?:\?|$)/);
  await page.goto("/not-a-real-route");
  await expect(
    page.getByRole("heading", { name: "잠깐, 다른 길로 왔네요." }),
  ).toBeVisible();
  const api = await page.request.get("/api/not-a-route", {
    headers: { "Sec-Fetch-Mode": "navigate" },
  });
  expect(api.status()).toBe(404);
  expect(api.headers()["content-type"]).toContain("application/json");
});
for (const width of [360, 390, 768, 1440]) {
  test(`responsive pages and keyboard focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    for (const url of ["/", "/songs", "/admin/login"]) {
      await page.goto(url);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (url === "/") {
        await mkdir("test-results/screenshots", { recursive: true });
        await page.screenshot({
          path: `test-results/screenshots/home-${width}.png`,
          fullPage: true,
        });
      }
    }
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "본문 바로가기" }),
    ).toBeFocused();
  });
}
test("admin login, create/edit, private separation, public search/detail, CSV, delete and logout", async ({
  page,
  context,
}) => {
  await page.goto("/admin/login");
  await page
    .getByLabel("아이디", { exact: true })
    .fill(process.env.ZIO_E2E_USERNAME);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(process.env.ZIO_E2E_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const mainMenu = page.getByRole("navigation", {
    name: "주 메뉴",
    exact: true,
  });
  await expect(
    page
      .getByRole("navigation", { name: "관리 기능 선택", exact: true })
      .getByRole("link", { name: "노래 관리", exact: true }),
  ).toHaveCount(0);
  await mainMenu.getByRole("link", { name: "노래 관리", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/songs$/);
  await expect(
    mainMenu.getByRole("link", { name: "노래 관리", exact: true }),
  ).toHaveClass(/active/);
  await expect(
    mainMenu.getByRole("link", { name: "관리자 관리", exact: true }),
  ).not.toHaveClass(/active/);
  await expect(
    page.getByRole("button", { name: "관리자 등록", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "관리자 메뉴", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "새 노래 등록" }).click();
  const editor = page.getByRole("form", { name: "노래 입력" });
  const dialog = page.getByRole("dialog");
  await editor.getByLabel("곡명").fill("QA 전용 곡");
  await editor.getByLabel("아티스트").fill("검증용 가수");
  await editor.getByLabel("장르", { exact: true }).fill("발라드");
  await editor.getByLabel("언어", { exact: true }).fill("한국어");
  await editor.getByLabel("신청 풍 개수").fill("77");
  await editor.getByLabel("지오 메모").fill("PUBLIC_MUST_NOT_SEE");
  await editor.getByRole("button", { name: "숙련도 1단계 선택" }).click();
  await editor.getByRole("button", { name: "등록하기", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "새 노래를 등록했습니다." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "QA 전용 곡", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/screenshots/admin-songs-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "QA 전용 곡 수정" }).click();
  await editor.getByRole("button", { name: "숙련도 5단계 선택" }).click();
  await expect(
    editor.getByRole("radio", { name: "미연습", exact: true }),
  ).toBeChecked();
  await editor
    .getByLabel("공개 상태", { exact: true })
    .selectOption({ label: "비공개" });
  await editor.getByRole("button", { name: "수정하기", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "노래를 수정했습니다." }),
  ).toBeVisible();
  const anonymous = await context
    .browser()
    .newContext({ baseURL: "http://127.0.0.1:5174" });
  const visitor = await anonymous.newPage();
  await visitor.setViewportSize({ width: 360, height: 900 });
  await visitor.goto("/songs");
  await expect(
    visitor.getByRole("link", { name: "QA 전용 곡", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "QA 전용 곡 공개로 전환" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "공개로 변경했습니다." }),
  ).toBeVisible();
  await visitor.reload();
  await visitor
    .getByRole("searchbox", { name: "곡명 또는 가수 검색" })
    .fill("QA");
  await visitor.getByLabel("숙련도 필터").selectOption("5");
  await expect(
    visitor.getByRole("link", { name: "QA 전용 곡", exact: true }),
  ).toBeVisible();
  expect(
    await visitor.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await visitor.screenshot({
    path: "test-results/screenshots/songs-360.png",
    fullPage: true,
  });
  await visitor.getByRole("link", { name: "QA 전용 곡", exact: true }).click();
  await expect(
    visitor.getByRole("heading", { name: "QA 전용 곡" }),
  ).toBeVisible();
  await visitor.screenshot({
    path: "test-results/screenshots/detail-360.png",
    fullPage: true,
  });
  await expect(visitor.getByText("77", { exact: false }).first()).toBeVisible();
  expect(await visitor.locator("body").textContent()).not.toContain(
    "PUBLIC_MUST_NOT_SEE",
  );
  await anonymous.close();
  await page.getByRole("button", { name: "CSV 가져오기" }).click();
  await dialog.getByLabel("CSV 파일 선택").setInputFiles({
    name: "qa.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "\uFEFFtitle,artist,description,genre,language,proficiency,practice_status,balloon_cost,memo,is_public\r\nQA CSV 곡,QA 가수,설명,팝,한국어,2,practicing,10,QA 메모,false\r\n",
    ),
  });
  await dialog.getByRole("button", { name: "미리보기 및 검증" }).click();
  await expect(
    dialog.getByRole("heading", { name: "총 1곡 · 정상 1곡 · 오류 0건" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "1곡 추가하기" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "1곡을 추가했습니다." }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "전체 CSV 백업" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/zio-songs-backup/);
  await page.getByRole("button", { name: "QA 전용 곡 삭제" }).click();
  await expect(
    dialog.getByRole("heading", { name: "노래를 삭제할까요?" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "삭제하기" }).click();
  await expect(
    page.getByRole("button", { name: "QA 전용 곡", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login(?:\?|$)/);
  await page.goto("/admin/songs");
  await expect(page).toHaveURL(/\/admin\/login(?:\?|$)/);
  expect(issues).toEqual([]);
});

test("administrator can register another administrator and the new account can log in", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await expect(
    page.getByRole("button", { name: "관리자 등록", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("아이디", { exact: true })
    .fill(process.env.ZIO_E2E_USERNAME);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(process.env.ZIO_E2E_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.screenshot({
    path: "test-results/screenshots/admin-menu-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/");
  await page.reload();
  const headerMenu = page
    .getByRole("navigation", { name: "주 메뉴", exact: true })
    .getByRole("link", { name: "관리자 관리", exact: true });
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  await expect(headerMenu).toBeVisible();
  await headerMenu.click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(
    page.locator(".sidebar-item").filter({ hasText: "관리자 관리" }),
  ).toHaveClass(/active/);
  await expect(
    page.locator(".sidebar-item").filter({ hasText: "노래 관리" }),
  ).not.toHaveClass(/active/);
  await expect(
    page
      .getByRole("navigation", { name: "관리 기능 선택", exact: true })
      .getByRole("link", { name: "노래 관리", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/screenshots/admin-menu-360.png",
    fullPage: true,
  });
  await openAdminMenu(page, "관리자 관리");
  await expect(
    page
      .getByRole("navigation", { name: "관리자 메뉴", exact: true })
      .getByRole("link", { name: "노래 관리", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /비밀번호 초기화/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "관리자 등록", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "관리자 등록", exact: true });
  await expect(dialog).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: "test-results/screenshots/admin-register-360.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 950 });
  await page.screenshot({
    path: "test-results/screenshots/admin-register-desktop.png",
    fullPage: true,
  });
  const username = `qa-web-${Date.now().toString(36)}`;
  const newPassword = crypto.randomUUID().slice(0, 8);
  await dialog.getByLabel("아이디", { exact: true }).fill(username);
  await dialog.getByLabel("표시 이름", { exact: true }).fill("추가 QA 관리자");
  await dialog.getByLabel("비밀번호", { exact: true }).fill(newPassword);
  await dialog
    .getByLabel("비밀번호 확인", { exact: true })
    .fill(crypto.randomUUID());
  await dialog.getByRole("button", { name: "관리자 등록하기" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "비밀번호 확인이 일치하지 않습니다.",
  );
  await dialog.getByLabel("비밀번호 확인", { exact: true }).fill(newPassword);
  await dialog.getByRole("button", { name: "관리자 등록하기" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "관리자를 등록했습니다." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "관리자 등록", exact: true }).click();
  await expect(dialog.getByLabel("비밀번호", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("비밀번호 확인", { exact: true })).toHaveValue(
    "",
  );
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login(?:\?|$)/);
  await page.getByLabel("아이디", { exact: true }).fill(username);
  await page.getByLabel("비밀번호", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByText("추가 QA 관리자님,", { exact: false }),
  ).toBeVisible();
  await openAdminMenu(page, "관리자 관리");
  await expect(
    page.getByRole("button", { name: "관리자 등록", exact: true }),
  ).toBeVisible();
  expect(issues).toEqual([]);
});

test("administrator resets a password and target must change it before using administration", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await page
    .getByLabel("아이디", { exact: true })
    .fill(process.env.ZIO_E2E_USERNAME);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(process.env.ZIO_E2E_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await openAdminMenu(page, "관리자 관리");
  await expect(page).toHaveURL(/\/admin\/users$/);
  await page.getByRole("button", { name: "관리자 등록", exact: true }).click();
  const registration = page.getByRole("dialog", {
    name: "관리자 등록",
    exact: true,
  });
  const username = `qa-reset-${Date.now().toString(36)}`,
    pass = crypto.randomUUID();
  await registration.getByLabel("아이디", { exact: true }).fill(username);
  await registration.getByLabel("표시 이름", { exact: true }).fill("초기화 QA");
  await registration.getByLabel("비밀번호", { exact: true }).fill(pass);
  await registration.getByLabel("비밀번호 확인", { exact: true }).fill(pass);
  await registration.getByRole("button", { name: "관리자 등록하기" }).click();
  await expect(registration).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /비밀번호 초기화/ }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 950 });
  await page.screenshot({
    path: "test-results/screenshots/admin-users-390.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "관리자 메뉴", exact: true })
    .getByRole("link", { name: "관리자 비밀번호 초기화", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/password-reset$/);
  await expect(
    page.getByRole("button", { name: `${username} 비밀번호 초기화` }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/screenshots/admin-password-reset-390.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: `${username} 비밀번호 초기화` })
    .click();
  const reset = page.getByRole("dialog", { name: "비밀번호를 초기화할까요?" });
  await reset.getByRole("button", { name: "초기화하기", exact: true }).click();
  await expect(reset).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "비밀번호를 초기화했습니다." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login(?:\?|$)/);
  await page.getByLabel("아이디", { exact: true }).fill(username);
  await page.getByLabel("비밀번호", { exact: true }).fill("qwer1234!@#$");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/password(?:\?|$)/);
  await expect(page.getByRole("status")).toContainText(
    "비밀번호의 변경이 필요합니다.",
  );
  for (const path of ["/admin", "/admin/users", "/admin/password-reset"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/password(?:\?|$)/);
  }
  await page.screenshot({
    path: "test-results/screenshots/password-change-390.png",
    fullPage: true,
  });
  const changed = crypto.randomUUID().slice(0, 8);
  await page.getByLabel("현재 비밀번호", { exact: true }).fill("qwer1234!@#$");
  await page.getByLabel("새 비밀번호", { exact: true }).fill(changed);
  await page.getByLabel("새 비밀번호 확인", { exact: true }).fill(changed);
  await page.getByRole("button", { name: "비밀번호 변경하기" }).click();
  await expect(page).toHaveURL(/\/admin\/login\?password_changed=1&next=/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(
    "/admin/password-reset",
  );
  await expect(
    page.getByText("비밀번호를 변경했습니다. 새 비밀번호로 로그인해주세요."),
  ).toBeVisible();
  await page.getByLabel("아이디", { exact: true }).fill(username);
  await page.getByLabel("비밀번호", { exact: true }).fill(changed);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/password-reset$/);
  await page
    .getByRole("navigation", { name: "관리자 메뉴", exact: true })
    .getByRole("link", { name: "관리자 관리", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "관리자 등록", exact: true }),
  ).toBeVisible();
  expect(issues).toEqual([]);
});
