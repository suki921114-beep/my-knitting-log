import { test, expect } from "@playwright/test";

/**
 * 프로젝트 흐름 회귀 테스트.
 *
 * 데이터 격리:
 *   Playwright 의 기본 동작상 각 test 마다 새로운 BrowserContext 가 생성되어
 *   localStorage / IndexedDB 가 비어 있다. 이 파일에서 만드는 테스트 프로젝트는
 *   Playwright 전용 프로파일에만 존재하므로 사용자가 평소 쓰는 Chrome 프로필의
 *   IndexedDB 를 건드리지 않는다.
 *
 * 그래도 만약 dev 서버 측 데이터(예: 클라우드 동기화)와 충돌할 가능성이 있는
 * 흐름은 TODO 로만 두고 구현하지 않는다.
 *
 * locator 전략:
 *   - 페이지 진입 확인은 PageHeader 의 <h1> 을 getByRole('heading') 으로
 *   - 폼 입력은 Field 컴포넌트가 <label><span>레이블</span><input/></label>
 *     형태라 getByLabel('프로젝트명') 으로 input 을 잡을 수 있음
 *   - 저장 버튼은 lucide 아이콘 + '저장' 텍스트라 getByRole('button', { name: '저장' })
 */

test.describe("프로젝트 — 목록 / 새 프로젝트 폼", () => {
  test("/projects 진입 시 프로젝트 heading + 새 프로젝트 진입 링크", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "프로젝트", exact: true })).toBeVisible();
    // 빈 상태에서도 어딘가에 '새 프로젝트' 진입점이 있어야 한다 (PageHeader right + 빈 상태 카드)
    await expect(page.getByRole("link", { name: /새 프로젝트/ }).first()).toBeVisible();
  });

  test("/projects/new 진입 시 새 프로젝트 heading + 프로젝트명 input + 저장 버튼", async ({ page }) => {
    await page.goto("/projects/new");
    await expect(page.getByRole("heading", { name: "새 프로젝트" })).toBeVisible();
    await expect(page.getByLabel("프로젝트명")).toBeVisible();
    await expect(page.getByRole("button", { name: "저장" })).toBeVisible();
  });
});

test.describe("프로젝트 — 생성 흐름", () => {
  test("새 프로젝트를 만들면 detail 페이지 heading 으로 표시된다", async ({ page }) => {
    // 고유한 이름으로 다른 테스트와 충돌 방지
    const projectName = `테스트 프로젝트 ${Date.now()}`;

    await page.goto("/projects/new");
    await expect(page.getByRole("heading", { name: "새 프로젝트" })).toBeVisible();

    await page.getByLabel("프로젝트명").fill(projectName);
    await page.getByRole("button", { name: "저장" }).click();

    // 저장 후 ProjectForm 은 /projects/:id 로 이동 → PageHeader title 이 입력한 이름
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

    // 목록으로 돌아갔을 때도 보여야 함 (Live query 반영 확인)
    await page.goto("/projects");
    await expect(page.getByText(projectName)).toBeVisible();
  });

  // TODO(test-cleanup): 위 생성 테스트는 격리된 Playwright 컨텍스트라 사용자
  // 데이터에 영향을 주지 않지만, 추후 클라우드 동기화까지 도는 e2e 가 추가되면
  // 테스트 종료 시 Firestore 의 테스트 프로젝트를 정리하는 후처리가 필요.
});
