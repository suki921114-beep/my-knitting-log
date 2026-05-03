import { test, expect } from "@playwright/test";

test("홈 화면 열림", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});

test("설정 페이지 열림", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "설정" })).toBeVisible();
});