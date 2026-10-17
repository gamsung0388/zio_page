import { expect } from "@playwright/test";
export async function loginAdmin(page) {
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
export async function adminHeaders(page) {
  const session = await (await page.request.get("/api/admin/me")).json();
  return { Origin: "http://127.0.0.1:5174", "X-CSRF-Token": session.csrfToken };
}
