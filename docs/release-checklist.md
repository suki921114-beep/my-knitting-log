# 출시 전 검증 체크리스트

이 문서는 main 브랜치를 Vercel production 으로 배포하기 전, 또는
Play Store / App Store 같은 외부 채널로 공개하기 전에 한 번씩 손으로
돌려보아야 하는 시나리오를 모은다.

기존 `docs/sync-test-checklist.md` (개발 중 sync 회귀 테스트) 와 별개로,
**출시 직전** 시점에 안정성/법적/UX 모두 한꺼번에 점검하는 용도다.

---

## 0. 사전 조건

- 마지막 commit 이 main 에 push 되어 있고 Vercel 빌드가 Ready 상태
- Firebase Console 에서 Authorized domains 에 배포 도메인 등록됨
- 테스트용 계정으로 로그인 가능
- 시크릿 창 또는 다른 기기 1대 이상 준비

---

## 1. Critical Sync Tests (데이터 안정성)

### 1-1. 전체 삭제 후 자동 백업 방지
- 사전: 로그인 + 데이터 N개 + 자동 백업 모드 = '항상'
- 절차: 설정 → 데이터 관리 → 전체 삭제 (confirm 2번) → 30초 대기
- 기대:
  - 자동 백업 토스트가 뜨지 않음
  - 라이브러리/프로젝트 모두 비어있는 상태 유지
  - 휴지통 카운트 = 0
- 실패 시 의심: clearAll() 의 dirty pause / clearSyncDirty 가드 누락
- 우선순위: **Critical**

### 1-2. 가져오기 중 강제 새로고침 (transaction rollback)
- 사전: 로그인 + 클라우드에 카운터/게이지가 있는 프로젝트
- 절차: PC에서 [가져오기] 누르고 진행 토스트 도중 Ctrl+R 강제 새로고침
- 기대:
  - 다시 진입했을 때 프로젝트의 sub-entity (카운터/게이지/연결관계) 가
    부분 유실되지 않음 (이전 상태 또는 완전 새 상태 둘 중 하나)
- 실패 시 의심: upsertProjectFromCloud 트랜잭션 누락
- 우선순위: **Critical**

### 1-3. v6 마이그레이션 후 dirty 미발생
- 사전: 이전 버전(string[] photos) 데이터를 가진 IndexedDB
  - 실제로는 신규 사용자/시크릿 창은 v6 부터 시작이라 재현 어려움
  - 최소 검증: 첫 새로고침 직후 4초 안에 자동 백업 토스트 안 뜨는지
- 절차: 자동 백업 모드 = '항상' 으로 둔 채 페이지 새로고침
- 기대: 5초~15초 동안 자동 백업 트리거되지 않음 (변경 없으면 dirty=false)
- 실패 시 의심: v6 upgrade 의 pause/clear 가드 미적용 / attachDirtyHooks 시점
- 우선순위: High

### 1-4. rowCounter soft delete 후 가져오기
- 사전: 카운터 1개 soft delete 한 상태 + 백업 안 함
- 절차: [가져오기] 실행
- 기대: 삭제했던 카운터가 부활하지 않거나, 부활한다면 사용자가 명확히 알 수 있는 동작
- 실패 시 의심: upsertProjectFromCloud 의 bulkDelete 가 isDeleted 메타까지
  지움 → 다음 단계 작업 후보
- 우선순위: High (현재 한계 — 알려진 이슈)

### 1-5. 자동/수동 백업 동시 실행 방지
- 사전: 자동 백업 = '항상', 변경 후 약 14초 시점
- 절차: 카운트다운 끝나기 직전 [백업] 버튼 클릭
- 기대: '다른 동기화가 진행 중이에요' 토스트 또는 lock 으로 한 흐름만 진행
- 실패 시 의심: beginSyncRun lock
- 우선순위: High

---

## 2. PWA / Offline Tests

### 2-1. 한 번 접속 후 오프라인 새로고침
- 사전: 배포 도메인을 한 번 접속 (Service Worker 등록)
- 절차: DevTools → Network → Offline 체크 → 새로고침
- 기대: 앱 shell 정상 표시 + 상단 amber '오프라인 모드' 배너
- 우선순위: High

### 2-2. 오프라인에서 로컬 데이터 조회/수정
- 사전: 2-1 상태
- 절차: 라이브러리 / 프로젝트 페이지 이동 → 새 프로젝트 추가 → 카운터 +1
- 기대: 모든 동작 정상. dirty 상태 표시됨.
- 우선순위: High

### 2-3. 오프라인에서 수동 백업 차단
- 사전: 2-1 상태
- 절차: 설정 → 백업 및 동기화 → [백업] 또는 [가져오기] 누름
- 기대: '오프라인 상태예요. 인터넷 연결 후 다시 시도해주세요.' 토스트
- 우선순위: High

### 2-4. 온라인 복귀 후 자동 백업 재시도
- 사전: 자동 백업 = '항상' + dirty 있음 + 오프라인
- 절차: Network Offline 해제 → 약 5초 대기
- 기대: 자동 백업 토스트 또는 lastAutoBackupAt 갱신
- 우선순위: Medium

---

## 3. SPA 라우팅 / 직접 접속

### 3-1. 직접 URL 접속
- 절차: 브라우저 주소창에 직접 다음을 입력
  - `/settings`
  - `/settings/backup`
  - `/settings/data`
  - `/settings/trash`
  - `/privacy`
  - `/terms` (있다면)
  - `/about` (있다면)
  - `/projects/123` (존재하는 id)
- 기대: 모든 경로 404 없이 정상 표시
- 실패 시 의심: vercel.json rewrites
- 우선순위: High

### 3-2. SW 등록 + 정적 파일
- 절차: DevTools → Application
- 기대:
  - Service Worker activated
  - Manifest 표시 (theme_color, icons)
  - Cache Storage 에 knit-app-v* 항목
- 우선순위: Medium

---

## 4. Legal / Policy Tests

### 4-1. 개인정보처리방침 접근
- 절차: 설정 → 정책 및 정보 → 개인정보처리방침
- 기대: 페이지 정상 표시. 처리 항목 / 저장 위치 / 보관 기간 / 탈퇴 / 문의처 명시
- 우선순위: **Critical (출시 전)**

### 4-2. 이용약관 접근
- 절차: 설정 → 정책 및 정보 → 이용약관
- 기대: 서비스 목적 / 책임 한계 / 데이터 백업 책임 / 변경 가능성 명시
- 우선순위: **Critical (출시 전)**

### 4-3. 앱 정보 / 오픈소스
- 절차: 설정 → 정책 및 정보 → 앱 정보
- 기대: 앱 버전 / 오픈소스 안내 / 문의 placeholder 표시
- 우선순위: Medium

### 4-4. placeholder 점검
- 절차: 위 3개 페이지 모두에서 'TODO' / 'placeholder' 단어가 사용자에게 그대로
  노출되는지 확인
- 기대:
  - 운영자 이메일 / 시행일은 출시 직전에 실제 값으로 교체되어야 함
  - 출시 전이라면 '운영자 입력 필요' 같은 명시적 placeholder 가 보이는 것은 OK
- 우선순위: **Critical (출시 전)**

### 4-5. 유료 기능 미구현 — 사업자 정보 미노출
- 절차: 설정 / 푸터 / 약관 페이지에서 '사업자등록번호', '통신판매업신고',
  '환불정책' 같은 단어가 사용자에게 노출되는지
- 기대: 노출되지 않음 (현재 유료 기능 없음)
- 우선순위: High

---

## 5. UX 회귀 점검

### 5-1. 모바일 화면 (DevTools → Device Mode 또는 실기기)
- 홈 / 라이브러리 / 프로젝트 / 설정 모두 가로 스크롤 없이 표시
- 하단 탭바 가림 없음 (최하단 콘텐츠가 가려지면 padding 부족)
- 카드 클릭 시 active scale 반응

### 5-2. 토스트 가시성
- 우상단 토스트 + Sonner duration 8000ms 유효
- '되돌리기' action 버튼 누르기 충분한 시간

### 5-3. 인앱 브라우저 안내
- 카카오톡 / 네이버 앱 / 인스타그램 인앱 브라우저로 도메인 진입 후
  /login 페이지의 amber 배너 표시 확인
- 일반 Chrome / Safari 에서는 배너 안 보임

---

## 6. 회귀 — 기존 기능 정상 동작

### 6-1. 핵심 흐름
- [ ] 새 프로젝트 생성 → 실/도안/바늘/부자재 연결 → 카운터 추가 → 게이지 추가
- [ ] 라이브러리 항목 수정 / 삭제 / 토스트 되돌리기
- [ ] 프로젝트 삭제 → 휴지통에 표시 → 복원 → 정상 보임
- [ ] JSON 내보내기 / 가져오기

### 6-2. 동기화 흐름 (1인 2기기)
- [ ] 모바일에서 프로젝트 추가 → 자동 백업
- [ ] PC 에서 [가져오기] → 새 프로젝트 보임
- [ ] PC 에서 카운터 +1 → 자동 백업
- [ ] 모바일에서 [가져오기] → 카운트 갱신

### 6-3. 인증
- [ ] Google 로그인 → 정상
- [ ] 로그아웃 → 게스트 모드 화면
- [ ] 게스트에서 새 프로젝트 추가 → 로컬 저장 OK
- [ ] 다시 로그인 → 데이터 그대로 보존

---

## 7. 출시 직전 체크 (실 운영 데이터 보호)

- [ ] Firebase Authorized domains 에 production 도메인 등록
- [ ] Firestore Rules 가 `users/{uid}` 본인 경로만 허용하도록 적용
  (사진 동기화 켤 때 Storage Rules 도)
- [ ] Vercel 환경변수 / 도메인 설정 확인
- [ ] 사용자에게 보여줄 문의 이메일 결정 (Privacy / Terms / About 의 placeholder
  일괄 갱신)
- [ ] 시행일 (Privacy / Terms) 갱신
- [ ] 알려진 한계 사항 release note 또는 README 에 명시
  - 사진은 무료 백업 미포함 (로컬 전용)
  - 'Wi-Fi에서만' 자동 백업이 모바일 일부 환경에서 보수적으로 동작

---

## 알려진 이슈 (이번 출시에 미해결)

- rowCounters / projectGauges 의 hard delete + 재생성 흐름이 로컬 isDeleted
  메타를 덮어쓸 수 있음 (위 1-4 참고)
- 'Wi-Fi에서만' 모드가 connection.type 미노출 환경에서 보수적으로 비활성화됨
- 사진 dataURL 용량 한계 — 캔버스 압축 미적용
- PWA 192/512 PNG 아이콘 부재 (favicon.ico 만 사용)
- alert/confirm UI 가 sonner toast 와 톤 불일치
- 유료 기능 도입 시 사업자 정보 / 통신판매업 신고 / 환불정책 추가 필요
