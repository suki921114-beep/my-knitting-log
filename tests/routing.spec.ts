import { test, expect } from "@playwright/test";

/**
 * 주요 라우트가 404 없이 열리고, 각 페이지 고유 heading 이 보이는지 확인.
 *
 * 각 라우트는 src/App.tsx 에 실제 등록된 것만 사용. 존재하지 않는 라우트는
 * 임의로 만들지 않는다.
 *
 * 짧은 한 글자 한국어 제목("실")처럼 다른 곳과 충돌 가능성이 있는 경우
 * { exact: true } 로 정확 일치만 허용.
 */

type Route = {
  path: string;
  /** 페이지에 떠야 할 heading 의 정확한 이름 (PageHeader title) */
  heading: string;
  /** 짧은 단어라 substring 충돌 위험이 있을 때만 true */
  exact?: boolean;
};

const ROUTES: Route[] = [
  { path: "/",                  heading: "내 작업실",     exact: true },
  { path: "/projects",          heading: "프로젝트",       exact: true },
  { path: "/library",           heading: "라이브러리",     exact: true },
  { path: "/library/yarns",     heading: "실",             exact: true },
  { path: "/library/patterns",  heading: "도안",           exact: true },
  { path: "/library/needles",   heading: "바늘",           exact: true },
  { path: "/library/notions",   heading: "부자재",         exact: true },
  { path: "/tools/gauge",       heading: "게이지 계산기" },
  { path: "/settings",          heading: "설정",           exact: true },
  { path: "/settings/backup",   heading: "백업 및 동기화" },
  { path: "/settings/data",     heading: "데이터 관리" },
  { path: "/settings/trash",    heading: "휴지통" },
  { path: "/privacy",           heading: "개인정보처리방침" },
  { path: "/terms",             heading: "이용약관" },
  { path: "/about",             heading: "앱 정보" },
];

test.describe("주요 라우트 — heading 표시", () => {
  for (const r of ROUTES) {
    test(`${r.path} → "${r.heading}" heading`, async ({ page }) => {
      await page.goto(r.path);
      await expect(
        page.getByRole("heading", { name: r.heading, exact: r.exact ?? false }),
      ).toBeVisible();
    });
  }
});
