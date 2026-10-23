import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { loginAdmin, adminHeaders } from "./support/admin.js";
import { DEFAULT_PROFILE } from "../../shared/site-profile.js";
const album = {
  provider: "itunes",
  track_id: 1591865716,
  storefront: "US",
  title: "Narrow road",
  artist: "Lucia",
  album_title: "Narrow road",
  artwork_url:
    "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/test/100x100bb.jpg",
  source_url:
    "https://music.apple.com/us/album/narrow-road/1591865712?i=1591865716",
};
let prefix;
async function seed(page, extra = {}) {
  const result = await page.request.post("/api/admin/songs", {
    headers: await adminHeaders(page),
    data: {
      title: prefix,
      artist: "검증 가수",
      genre: "발라드",
      proficiency: 3,
      practice_status: "practicing",
      balloon_cost: 2,
      memo: "PRIVATE_OPERATION_MEMO",
      is_public: true,
      ...extra,
    },
  });
  expect(result.status()).toBe(201);
  return result.json();
}
test.beforeEach(async ({ page }) => {
  prefix = "운영검증-" + randomUUID().slice(0, 8);
  await loginAdmin(page);
});
test.afterEach(async ({ page }) => {
  const headers = await adminHeaders(page),
    list = await (
      await page.request.get(
        "/api/admin/songs?q=" + encodeURIComponent(prefix) + "&page_size=100",
      )
    ).json();
  for (const song of list.items || [])
    await page.request.delete("/api/admin/songs/" + song.id, {
      headers,
      data: { expected_revision: song.revision },
    });
  const profile = await (await page.request.get("/api/admin/site")).json();
  if (profile.revision)
    await page.request.put("/api/admin/site", {
      headers,
      data: {
        ...structuredClone(DEFAULT_PROFILE),
        expected_revision: profile.revision,
      },
    });
});
test("album search selects a version without overwriting local fields and unlinking returns the default cover", async ({
  page,
}) => {
  const song = await seed(page);
  await page.route("**/api/admin/catalog/search", (route) =>
    route.fulfill({ json: { items: [album], country: "US" } }),
  );
  await page.route("https://*.mzstatic.com/**", async (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: await readFile("public/images/covers/night.svg"),
    }),
  );
  await page.goto("/admin/songs/" + song.id + "/edit");
  await page.getByRole("button", { name: "앨범 찾기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "앨범 찾기", exact: true });
  await dialog.getByLabel("앨범 검색어", { exact: true }).fill("심규선 소로");
  await dialog.getByRole("button", { name: "검색", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Narrow road 앨범 연결", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("곡명", { exact: true })).toHaveValue(prefix);
  await expect(page.getByLabel("지오 메모", { exact: true })).toHaveValue(
    "PRIVATE_OPERATION_MEMO",
  );
  await page.getByRole("button", { name: "수정하기", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/songs$/);
  const saved = await (await page.request.get("/api/songs/" + song.id)).json();
  expect(saved.album).toEqual(album);
  expect(saved.memo).toBeUndefined();
  await page.goto("/songs/" + song.id);
  await expect(
    page.locator(".detail-title-area .album-source"),
  ).toHaveAttribute("href", album.source_url);
  await expect(page.locator(".detail-title-area")).not.toContainText(
    "PRIVATE_OPERATION_MEMO",
  );
  await page.goto("/admin/songs/" + song.id + "/edit");
  await page
    .getByRole("button", { name: "앨범 연결 해제", exact: true })
    .click();
  await page.getByRole("button", { name: "수정하기", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/songs$/);
  expect(
    (await (await page.request.get("/api/songs/" + song.id)).json()).album,
  ).toBeUndefined();
});
test("song trash offers cancel, private restore and confirmed permanent deletion with a readable history", async ({
  page,
}) => {
  const song = await seed(page, { album });
  await page.goto("/admin/songs?q=" + encodeURIComponent(prefix));
  await page
    .getByRole("button", { name: prefix + " 삭제", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제하기", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/admin/recovery?type=songs");
  let row = page.locator(".recovery-item").filter({ hasText: prefix });
  await row
    .getByRole("button", { name: prefix + " 복원", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "복원하기", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  const restored = await (
    await page.request.get("/api/admin/songs/" + song.id)
  ).json();
  expect(restored.is_public).toBe(false);
  expect(restored.album).toEqual(album);
  await page.request.delete("/api/admin/songs/" + song.id, {
    headers: await adminHeaders(page),
    data: { expected_revision: restored.revision },
  });
  await page.reload();
  row = page.locator(".recovery-item").filter({ hasText: prefix });
  await row
    .getByRole("button", { name: prefix + " 영구 삭제", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "취소", exact: true })
    .click();
  await expect(row).toBeVisible();
  await row
    .getByRole("button", { name: prefix + " 영구 삭제", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "영구 삭제하기", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  await page
    .getByRole("button", { name: "최근 변경 기록", exact: true })
    .click();
  await expect(
    page.locator(".recovery-item").filter({ hasText: prefix }).first(),
  ).toContainText("영구 삭제");
});
test("bulk editor reports a concurrent conflict and copied songs start private without copied notes", async ({
  page,
}) => {
  const first = await seed(page, { title: prefix + " A", album }),
    second = await seed(page, { title: prefix + " B" });
  await page.goto("/admin/songs?q=" + encodeURIComponent(prefix));
  await page
    .getByRole("checkbox", { name: first.title + " 선택", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: second.title + " 선택", exact: true })
    .check();
  await page.request.patch("/api/admin/songs/" + second.id, {
    headers: await adminHeaders(page),
    data: { proficiency: 5, expected_revision: 1 },
  });
  await page
    .getByRole("button", { name: "선택 곡 일괄 수정", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "선택한 노래 일괄 수정",
    exact: true,
  });
  await dialog
    .getByRole("combobox", { name: "변경할 값", exact: true })
    .selectOption("completed");
  await dialog
    .getByRole("button", { name: "2곡 변경하기", exact: true })
    .click();
  await expect(page.locator(".bulk-result")).toContainText("1곡을 변경했어요.");
  await expect(page.locator(".bulk-result")).toContainText(
    "1곡은 건너뛰었습니다",
  );
  await page
    .getByRole("button", { name: first.title + " 복사 등록", exact: true })
    .click();
  await expect(page.getByLabel("공개 상태", { exact: true })).toHaveValue(
    "false",
  );
  await expect(page.getByLabel("지오 메모", { exact: true })).toHaveValue("");
  await expect(page.locator(".album-selected")).toContainText("Narrow road");
  await page.getByLabel("곡명", { exact: true }).fill(prefix + " 복사");
  await page.getByRole("button", { name: "등록하기", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/songs(?:\?|$)/);
  const copied = await (
    await page.request.get(
      "/api/admin/songs?q=" + encodeURIComponent(prefix + " 복사"),
    )
  ).json();
  expect(copied.items[0].is_public).toBe(false);
  expect(copied.items[0].memo).toBe("");
  expect(copied.items[0].album).toEqual(album);
});
test("homepage information and featured songs are editable and stale settings do not overwrite the winner", async ({
  page,
}) => {
  const song = await seed(page);
  await page.goto("/admin/site");
  await page
    .getByLabel("메인 제목", { exact: true })
    .fill(prefix + "의 음악방");
  await page.getByLabel("추천할 공개 곡 검색", { exact: true }).fill(prefix);
  await page.getByRole("button", { name: "곡 찾기", exact: true }).click();
  await page.getByRole("button", { name: "추천에 추가", exact: true }).click();
  await page
    .getByRole("button", { name: "공식 링크 추가", exact: true })
    .click();
  await page.getByLabel("링크 이름", { exact: true }).fill("공식 영상");
  await page
    .getByLabel("HTTPS 주소", { exact: true })
    .fill("https://example.com/zio");
  await page
    .getByRole("button", { name: "홈페이지 정보 저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "홈페이지 정보 저장", exact: true }),
  ).toBeDisabled();
  const publicData = await (await page.request.get("/api/site")).json();
  expect(publicData.featured.map((row) => row.id)).toEqual([song.id]);
  expect(JSON.stringify(publicData)).not.toContain("PRIVATE_OPERATION_MEMO");
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText(prefix + "의 음악방");
  await expect(
    page.getByRole("link", { name: "공식 영상 ↗", exact: true }),
  ).toHaveAttribute("href", "https://example.com/zio");
  await page.goto("/admin/site");
  await page.getByLabel("메인 제목", { exact: true }).fill(prefix + " 내 수정");
  const current = await (await page.request.get("/api/admin/site")).json();
  await page.request.put("/api/admin/site", {
    headers: await adminHeaders(page),
    data: {
      ...current.profile,
      intro_title: prefix + " 먼저 저장",
      expected_revision: current.revision,
    },
  });
  await page
    .getByRole("button", { name: "홈페이지 정보 저장", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("다른 곳에서");
  await expect(page.getByLabel("메인 제목", { exact: true })).toHaveValue(
    prefix + " 내 수정",
  );
  page.once("dialog", (d) => d.accept());
  await page.goto("/admin");
});
test("album-inclusive JSON backup stages one selected song privately without writing before confirmation", async ({
  page,
}) => {
  const song = await seed(page, { album });
  await page.goto("/admin/songs?q=" + encodeURIComponent(prefix));
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "앨범 포함 JSON 백업", exact: true })
    .click();
  const file = await (await download).path(),
    json = JSON.parse(await readFile(file, "utf8"));
  const selected = json.songs.find((row) => row.title === song.title);
  expect(selected.album).toEqual(album);
  await page
    .getByRole("button", { name: "JSON 백업 가져오기", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "백업에서 노래 가져오기",
    exact: true,
  });
  await dialog
    .getByLabel("노래 JSON 백업 파일", { exact: true })
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ ...json, songs: [selected] })),
    });
  await dialog
    .getByRole("button", { name: "등록 화면에서 확인", exact: true })
    .click();
  await expect(page.getByLabel("공개 상태", { exact: true })).toHaveValue(
    "false",
  );
  await expect(page.getByLabel("지오 메모", { exact: true })).toHaveValue(
    "PRIVATE_OPERATION_MEMO",
  );
  await expect(page.locator(".album-selected")).toContainText(album.title);
  expect(
    (
      await (
        await page.request.get(
          "/api/admin/songs?q=" + encodeURIComponent(prefix),
        )
      ).json()
    ).pagination.total,
  ).toBe(1);
  await page.getByLabel("곡명", { exact: true }).fill(prefix + " 백업 복원");
  await page.getByRole("button", { name: "등록하기", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/songs$/);
});
test("administrator controls disable self actions and support deactivation, reactivation, and session revoke", async ({
  page,
}) => {
  const username = "op-" + randomUUID().slice(0, 8);
  const response = await page.request.post("/api/admin/users", {
    headers: await adminHeaders(page),
    data: {
      username,
      display_name: prefix,
      password: process.env.ZIO_E2E_PASSWORD,
      password_confirmation: process.env.ZIO_E2E_PASSWORD,
    },
  });
  expect(response.status()).toBe(201);
  await page.goto("/admin/users");
  await expect(
    page.getByRole("button", {
      name: process.env.ZIO_E2E_USERNAME + " 사용 중지",
      exact: true,
    }),
  ).toBeDisabled();
  const row = page.locator(".admin-account").filter({ hasText: username });
  await row
    .getByRole("button", { name: username + " 사용 중지", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "확인하고 적용", exact: true })
    .click();
  await expect(row).toContainText("비활성");
  await row
    .getByRole("button", { name: username + " 사용 재개", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "확인하고 적용", exact: true })
    .click();
  await expect(row).toContainText("활성");
  await row
    .getByRole("button", { name: username + " 로그인 해제", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "확인하고 적용", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("mobile search comes before collapsed filters and all operation pages fit five viewport sizes", async ({
  page,
}) => {
  test.setTimeout(90000);
  await mkdir(".local/operations-review/screenshots", { recursive: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(size);
    for (const [path, name] of [
      ["/songs", "songs"],
      ["/admin/site", "site"],
      ["/admin/recovery", "recovery"],
      ["/admin/songs/new", "editor"],
      ["/admin/users", "users"],
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      if (name === "songs" && size.width < 600) {
        const search = page.getByRole("searchbox", {
          name: "곡명 또는 가수 검색",
          exact: true,
        });
        expect((await search.boundingBox()).y).toBeLessThan(size.height * 0.7);
        await expect(page.getByLabel("숙련도 필터")).not.toBeVisible();
        await page.getByRole("button", { name: /상세 필터/ }).click();
        await expect(page.getByLabel("숙련도 필터")).toBeVisible();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path:
          ".local/operations-review/screenshots/" +
          size.width +
          "-" +
          name +
          ".png",
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});
