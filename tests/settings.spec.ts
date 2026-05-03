import { test, expect } from "@playwright/test";

/**
 * Settings 화면 회귀 테스트.
 * /settings 본 페이지 + 각 진입 메뉴 + 휴지통/백업 하위 페이지 진입 확인.
 *
 * 모든 검증은 getByRole 기반 — 같은 텍스트가 NavLink / 버튼 / 헤딩으로 여러 번
 * 등장하기 때문.
 */

test.describe("Settings — 정보 구조", () => {
  test("/settings 진입 시 설정 heading 이 보인다", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "설정" })).toBeVisible();
  });

  test("4개 섹션 헤딩이 모두 보인다", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "계정" })).toBeVisible();
    // exact 로 잡아 다른 페이지의 "로컬 파일 백업" 같은 부분 일치 충돌 방지
    await expect(page.getByRole("heading", { name: "백업 및 동기화", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "데이터 관리" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "정책 및 정보" })).toBeVisible();
  });

  test("백업 / 데이터 관리 / 정책 메뉴 카드가 보인다", async ({ page }) => {
    await page.goto("/settings");
    // MenuCard 의 title 은 div 라 role 이 없음 → getByRole(button) 으로 카드 자체를 잡고
    // 버튼 안의 텍스트로 식별. button 의 accessible name 은 안의 모든 텍스트가 합쳐진다.
    await expect(page.getByRole("button", { name: /클라우드 백업.*자동 백업/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^데이터 관리/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /개인정보처리방침/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /이용약관/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /앱 정보/ })).toBeVisible();
  });

  test("/settings/trash 진입 시 휴지통 heading 이 보인다", async ({ page }) => {
    await page.goto("/settings/trash");
    await expect(page.getByRole("heading", { name: "휴지통" })).toBeVisible();
  });

  test("/settings/data 안에 휴지통 진입 링크가 있다", async ({ page }) => {
    await page.goto("/settings/data");
    await expect(page.getByRole("heading", { name: "데이터 관리" })).toBeVisible();
    // '삭제된 항목' 카드 = 휴지통 진입 버튼
    await expect(page.getByRole("button", { name: /삭제된 항목/ })).toBeVisible();
  });

  test("/settings/backup 진입 시 백업 및 동기화 heading 이 보인다", async ({ page }) => {
    await page.goto("/settings/backup");
    // /settings/backup 안에는 h1 "백업 및 동기화" 외에도 h2 "로컬 파일 백업" 이
    // 있어 substring "백업" 으로는 strict mode violation. exact 로 정확 일치만 허용.
    await expect(
      page.getByRole("heading", { name: "백업 및 동기화", exact: true }),
    ).toBeVisible();
  });

  // TODO(release-prep): "로컬 AI 테스트" 버튼은 개발 중 임시 진입점.
  // 출시 전 Settings.tsx 에서 제거하거나 dev-only 페이지로 분리할 것.
  // 그때 이 테스트도 같이 제거.
  test("[temp] 로컬 AI 테스트 버튼이 보인다", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "로컬 AI 테스트" })).toBeVisible();
  });
});
