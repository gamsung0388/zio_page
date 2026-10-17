import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  loginAdmin as login,
  adminHeaders as headers,
} from "./support/admin.js";

test.use({ timezoneId: "America/Los_Angeles" });
let created = [];
async function createSong(page) {
  const response = await page.request.post("/api/admin/songs", {
    headers: await headers(page),
    data: {
      title: "동시 수정 검증",
      artist: "검증 가수",
      proficiency: 3,
      memo: "BASE_PRIVATE_MEMO",
    },
  });
  expect(response.status()).toBe(201);
  const song = await response.json();
  created.push(song.id);
  return song;
}
async function patch(page, song, changes) {
  const response = await page.request.patch("/api/admin/songs/" + song.id, {
    headers: await headers(page),
    data: { ...changes, expected_revision: song.revision },
  });
  expect(response.status()).toBe(200);
  return response.json();
}
test.beforeEach(async ({ page }) => {
  await mkdir(".local/priority-review/screenshots", { recursive: true });
  await login(page);
});
test.afterEach(async ({ page }) => {
  for (const id of created) {
    const response = await page.request.get("/api/admin/songs/" + id);
    if (response.ok()) {
      const song = await response.json();
      await page.request.delete("/api/admin/songs/" + id, {
        headers: await headers(page),
        data: { expected_revision: song.revision },
      });
    }
  }
  created = [];
});

test("two open editors retain a conflicting draft and merge explicit choices with the latest private memo", async ({
  page,
}) => {
  const song = await createSong(page);
  const other = await page.context().newPage();
  await page.goto("/admin/songs/" + song.id + "/edit");
  await other.goto("http://127.0.0.1:5174/admin/songs/" + song.id + "/edit");
  const mine = other.getByRole("form", { name: "노래 입력" });
  await expect(mine.getByLabel("곡명")).toHaveValue(song.title);
  await page.getByLabel("곡명").fill("먼저 저장한 제목");
  await page.getByLabel("지오 메모").fill("SERVER_PRIVATE_MEMO");
  await page.getByRole("button", { name: "수정하기", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/songs$/);
  await mine.getByLabel("곡명").fill("내가 선택할 제목");
  await mine.getByLabel("아티스트").fill("내가 고친 가수");
  await mine.getByRole("button", { name: "수정하기", exact: true }).click();
  await expect(mine.getByRole("alert")).toContainText("다른 관리자");
  await expect(mine.getByLabel("곡명")).toHaveValue("내가 선택할 제목");
  await other
    .getByRole("button", { name: "저장된 내용과 비교", exact: true })
    .click();
  const dialog = other.getByRole("dialog", {
    name: "저장된 노래와 내 입력 비교",
  });
  await expect(
    dialog.getByRole("button", { name: "선택한 내용으로 편집 계속" }),
  ).toBeDisabled();
  await dialog
    .getByRole("radio", { name: "곡명 내 입력 사용", exact: true })
    .check();
  await expect(
    dialog.getByRole("radio", {
      name: "관리자 메모 (비공개) 저장된 내용 사용",
      exact: true,
    }),
  ).toBeChecked();
  await mkdir(".local/priority-review/screenshots", { recursive: true });
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await other.setViewportSize(size);
    expect(
      await other.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await other.screenshot({
      path:
        ".local/priority-review/screenshots/" + size.width + "-song-review.png",
    });
  }
  await dialog
    .getByRole("button", { name: "선택한 내용으로 편집 계속" })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(mine.getByLabel("지오 메모")).toHaveValue("SERVER_PRIVATE_MEMO");
  let latest = await (
    await page.request.get("/api/admin/songs/" + song.id)
  ).json();
  expect(latest.revision).toBe(2); // Review is a local form operation, not an automatic save.
  await mine.getByRole("button", { name: "수정하기", exact: true }).click();
  await expect(other).toHaveURL(/\/admin\/songs$/);
  latest = await (await page.request.get("/api/admin/songs/" + song.id)).json();
  expect(latest.title).toBe("내가 선택할 제목");
  expect(latest.artist).toBe("내가 고친 가수");
  expect(latest.memo).toBe("SERVER_PRIVATE_MEMO");
  expect(latest.revision).toBe(3);
  const publicSong = await (
    await page.request.get("/api/songs/" + song.id)
  ).json();
  expect(JSON.stringify(publicSong)).not.toContain("PRIVATE_MEMO");
  expect(publicSong.revision).toBeUndefined();
  await other.close();
});

test("stale song list visibility and deletion actions require selecting the latest item", async ({
  page,
}) => {
  let song = await createSong(page);
  await page.goto("/admin/songs");
  await expect(
    page.getByRole("button", {
      name: song.title + " 비공개로 전환",
      exact: true,
    }),
  ).toBeVisible();
  song = await patch(page, song, { title: "저장 후 바뀐 곡명" });
  await page
    .getByRole("button", { name: "동시 수정 검증 비공개로 전환", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("최신 목록");
  await expect(
    page.getByRole("button", { name: song.title + " 삭제", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: song.title + " 삭제", exact: true })
    .click();
  song = await patch(page, song, { memo: "MORE_RECENT_PRIVATE_MEMO" });
  const dialog = page.getByRole("dialog", { name: "노래를 삭제할까요?" });
  await dialog.getByRole("button", { name: "삭제하기", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("다시 선택");
  expect((await page.request.get("/api/admin/songs/" + song.id)).status()).toBe(
    200,
  );
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
});

test("a recovered song draft keeps its old revision and cannot silently overwrite a later edit or deleted song", async ({
  page,
}) => {
  let song = await createSong(page);
  await page.goto("/admin/songs/" + song.id + "/edit");
  await page.getByLabel("곡명").fill("보관한 초안 제목");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.values(sessionStorage).some((value) =>
          value.includes("보관한 초안 제목"),
        ),
      ),
    )
    .toBe(true);
  song = await patch(page, song, { title: "초안 뒤에 저장한 제목" });
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "초안 복구", exact: true }).click();
  await expect(page.getByLabel("곡명")).toHaveValue("보관한 초안 제목");
  await page.getByRole("button", { name: "수정하기", exact: true }).click();
  await expect(
    page.getByRole("form", { name: "노래 입력" }).getByRole("alert"),
  ).toContainText("다른 관리자");
  await page
    .getByRole("button", { name: "저장된 내용과 비교", exact: true })
    .click();
  const comparison = page.getByRole("dialog", {
    name: "저장된 노래와 내 입력 비교",
  });
  await expect(
    comparison.getByRole("radio", { name: "곡명 내 입력 사용", exact: true }),
  ).not.toBeChecked();
  await expect(
    comparison.getByRole("button", { name: "선택한 내용으로 편집 계속" }),
  ).toBeDisabled();
  await comparison
    .getByRole("button", { name: "내 입력으로 돌아가기", exact: true })
    .click();
  await page.request.delete("/api/admin/songs/" + song.id, {
    headers: await headers(page),
    data: { expected_revision: song.revision },
  });
  await page
    .getByRole("button", { name: "저장된 내용과 비교", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "노래 변경 충돌 안내" })
      .getByRole("alert"),
  ).toContainText("삭제됐어요");
  await expect(page.getByLabel("곡명")).toHaveValue("보관한 초안 제목");
});
