import { test, expect } from "@playwright/test";

/**
 * Smoke tests — 앱이 부팅되고 가장 핵심 두 페이지가 열리는지만 본다.
 * 더 자세한 회귀 검증은 settings.spec.ts / routing.spec.ts / projects.spec.ts 로 분리.
 *
 * 중복 텍스트(strict mode violation) 회피용 노트:
 *   - "설정"  : <h1>(PageHeader) + 하단 탭 NavLink → heading role 로 1개로 한정
 *   - "계정"  : <h2>(Section) + 로그인 버튼 → heading role 로 1개로 한정
 *   - "백업"  : Settings 본 페이지엔 "백업 및 동기화" h2 1개만 있지만,
 *               다른 페이지의 "로컬 파일 백업" 등과의 미래 충돌 방지를 위해 exact 사용.
 */

test("홈 화면이 부팅된다", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByRole("heading", { name: "내 작업실" })).toBeVisible();
});

test("설정 페이지가 열린다", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "설정" })).toBeVisible();
});

test("설정 화면 주요 섹션이 표시된다", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "설정" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "계정" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "백업 및 동기화", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "데이터 관리" })).toBeVisible();
});
