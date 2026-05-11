# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings.spec.ts >> Settings — 정보 구조 >> [temp] 로컬 AI 테스트 버튼이 보인다
- Location: tests\settings.spec.ts:61:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: '로컬 AI 테스트' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: '로컬 AI 테스트' })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - generic [ref=e3]:
    - main [ref=e4]:
      - generic [ref=e5]:
        - heading "설정" [level=1] [ref=e9]
        - generic [ref=e10]:
          - heading "계정" [level=2] [ref=e11]
          - generic [ref=e13]:
            - generic [ref=e14]:
              - img [ref=e16]
              - generic [ref=e20]:
                - generic [ref=e21]:
                  - generic [ref=e22]: 게스트 모드
                  - generic [ref=e23]: OFFLINE
                - generic [ref=e24]: 데이터를 동기화하려면 로그인하세요
            - button "계정 연결 (로그인)" [ref=e25] [cursor=pointer]:
              - img [ref=e27]
              - generic [ref=e30]: 계정 연결 (로그인)
              - img [ref=e31]
        - generic [ref=e33]:
          - heading "백업 및 동기화" [level=2] [ref=e34]
          - button "클라우드 백업 · 자동 백업 가져오기, 자동 백업, 마지막 결과, 파일 백업" [ref=e36] [cursor=pointer]:
            - img [ref=e38]
            - generic [ref=e42]:
              - generic [ref=e43]: 클라우드 백업 · 자동 백업
              - generic [ref=e44]: 가져오기, 자동 백업, 마지막 결과, 파일 백업
            - img [ref=e45]
        - generic [ref=e47]:
          - heading "데이터 관리" [level=2] [ref=e48]
          - button "데이터 관리 휴지통, 전체 삭제" [ref=e50] [cursor=pointer]:
            - img [ref=e52]
            - generic [ref=e56]:
              - generic [ref=e57]: 데이터 관리
              - generic [ref=e58]: 휴지통, 전체 삭제
            - img [ref=e59]
        - generic [ref=e61]:
          - heading "정책 및 정보" [level=2] [ref=e62]
          - generic [ref=e63]:
            - button "개인정보처리방침 데이터 저장 위치, 보관 기간, 탈퇴 요청" [ref=e64] [cursor=pointer]:
              - img [ref=e66]
              - generic [ref=e69]:
                - generic [ref=e70]: 개인정보처리방침
                - generic [ref=e71]: 데이터 저장 위치, 보관 기간, 탈퇴 요청
              - img [ref=e72]
            - button "이용약관 서비스 목적, 책임 한계, 변경 가능성" [ref=e74] [cursor=pointer]:
              - img [ref=e76]
              - generic [ref=e79]:
                - generic [ref=e80]: 이용약관
                - generic [ref=e81]: 서비스 목적, 책임 한계, 변경 가능성
              - img [ref=e82]
            - button "앱 정보 버전, 오픈소스 라이선스, 문의처" [ref=e84] [cursor=pointer]:
              - img [ref=e86]
              - generic [ref=e88]:
                - generic [ref=e89]: 앱 정보
                - generic [ref=e90]: 버전, 오픈소스 라이선스, 문의처
              - img [ref=e91]
        - generic [ref=e93]:
          - heading "버그 신고" [level=2] [ref=e94]
          - link "버그 신고 문제 상황과 에러 로그 복사하기 ›" [ref=e96] [cursor=pointer]:
            - /url: /settings/bug-report
            - generic [ref=e97]:
              - generic [ref=e98]: 버그 신고
              - generic [ref=e99]: 문제 상황과 에러 로그 복사하기
            - generic [ref=e100]: ›
    - navigation [ref=e101]:
      - generic [ref=e102]:
        - link "홈" [ref=e103] [cursor=pointer]:
          - /url: /
          - img [ref=e105]
          - text: 홈
        - link "프로젝트" [ref=e108] [cursor=pointer]:
          - /url: /projects
          - img [ref=e110]
          - text: 프로젝트
        - link "라이브러리" [ref=e112] [cursor=pointer]:
          - /url: /library
          - img [ref=e114]
          - text: 라이브러리
        - link "설정" [ref=e118] [cursor=pointer]:
          - /url: /settings
          - img [ref=e120]
          - text: 설정
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | /**
  4  |  * Settings 화면 회귀 테스트.
  5  |  * /settings 본 페이지 + 각 진입 메뉴 + 휴지통/백업 하위 페이지 진입 확인.
  6  |  *
  7  |  * 모든 검증은 getByRole 기반 — 같은 텍스트가 NavLink / 버튼 / 헤딩으로 여러 번
  8  |  * 등장하기 때문.
  9  |  */
  10 | 
  11 | test.describe("Settings — 정보 구조", () => {
  12 |   test("/settings 진입 시 설정 heading 이 보인다", async ({ page }) => {
  13 |     await page.goto("/settings");
  14 |     await expect(page.getByRole("heading", { name: "설정" })).toBeVisible();
  15 |   });
  16 | 
  17 |   test("4개 섹션 헤딩이 모두 보인다", async ({ page }) => {
  18 |     await page.goto("/settings");
  19 |     await expect(page.getByRole("heading", { name: "계정" })).toBeVisible();
  20 |     // exact 로 잡아 다른 페이지의 "로컬 파일 백업" 같은 부분 일치 충돌 방지
  21 |     await expect(page.getByRole("heading", { name: "백업 및 동기화", exact: true })).toBeVisible();
  22 |     await expect(page.getByRole("heading", { name: "데이터 관리" })).toBeVisible();
  23 |     await expect(page.getByRole("heading", { name: "정책 및 정보" })).toBeVisible();
  24 |   });
  25 | 
  26 |   test("백업 / 데이터 관리 / 정책 메뉴 카드가 보인다", async ({ page }) => {
  27 |     await page.goto("/settings");
  28 |     // MenuCard 의 title 은 div 라 role 이 없음 → getByRole(button) 으로 카드 자체를 잡고
  29 |     // 버튼 안의 텍스트로 식별. button 의 accessible name 은 안의 모든 텍스트가 합쳐진다.
  30 |     await expect(page.getByRole("button", { name: /클라우드 백업.*자동 백업/ })).toBeVisible();
  31 |     await expect(page.getByRole("button", { name: /^데이터 관리/ })).toBeVisible();
  32 |     await expect(page.getByRole("button", { name: /개인정보처리방침/ })).toBeVisible();
  33 |     await expect(page.getByRole("button", { name: /이용약관/ })).toBeVisible();
  34 |     await expect(page.getByRole("button", { name: /앱 정보/ })).toBeVisible();
  35 |   });
  36 | 
  37 |   test("/settings/trash 진입 시 휴지통 heading 이 보인다", async ({ page }) => {
  38 |     await page.goto("/settings/trash");
  39 |     await expect(page.getByRole("heading", { name: "휴지통" })).toBeVisible();
  40 |   });
  41 | 
  42 |   test("/settings/data 안에 휴지통 진입 링크가 있다", async ({ page }) => {
  43 |     await page.goto("/settings/data");
  44 |     await expect(page.getByRole("heading", { name: "데이터 관리" })).toBeVisible();
  45 |     // '삭제된 항목' 카드 = 휴지통 진입 버튼
  46 |     await expect(page.getByRole("button", { name: /삭제된 항목/ })).toBeVisible();
  47 |   });
  48 | 
  49 |   test("/settings/backup 진입 시 백업 및 동기화 heading 이 보인다", async ({ page }) => {
  50 |     await page.goto("/settings/backup");
  51 |     // /settings/backup 안에는 h1 "백업 및 동기화" 외에도 h2 "로컬 파일 백업" 이
  52 |     // 있어 substring "백업" 으로는 strict mode violation. exact 로 정확 일치만 허용.
  53 |     await expect(
  54 |       page.getByRole("heading", { name: "백업 및 동기화", exact: true }),
  55 |     ).toBeVisible();
  56 |   });
  57 | 
  58 |   // TODO(release-prep): "로컬 AI 테스트" 버튼은 개발 중 임시 진입점.
  59 |   // 출시 전 Settings.tsx 에서 제거하거나 dev-only 페이지로 분리할 것.
  60 |   // 그때 이 테스트도 같이 제거.
  61 |   test("[temp] 로컬 AI 테스트 버튼이 보인다", async ({ page }) => {
  62 |     await page.goto("/settings");
> 63 |     await expect(page.getByRole("button", { name: "로컬 AI 테스트" })).toBeVisible();
     |                                                                   ^ Error: expect(locator).toBeVisible() failed
  64 |   });
  65 | });
  66 | 
  67 | test("/settings/bug-report 진입 시 버그 신고 화면이 보인다", async ({ page }) => {
  68 |   await page.goto("/settings/bug-report");
  69 | 
  70 |   await expect(page.getByRole("heading", { name: "버그 신고" })).toBeVisible();
  71 | 
  72 |   await expect(
  73 |     page.getByPlaceholder("어떤 화면에서 어떤 문제가 있었는지 적어 주세요.")
  74 |   ).toBeVisible();
  75 | 
  76 |   await expect(
  77 |     page.getByRole("button", { name: "Gmail로 버그 신고 보내기" })
  78 |   ).toBeVisible();
  79 | 
  80 |   await expect(
  81 |     page.getByRole("button", { name: "신고 내용 복사" })
  82 |   ).toBeVisible();
  83 | 
  84 |   await expect(
  85 |     page.getByRole("button", { name: "에러 로그 비우기" })
  86 |   ).toBeVisible();
  87 | });
```