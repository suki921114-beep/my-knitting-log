# Vercel 배포 가이드

`my-knitting-log` 를 Vercel 에 배포하고 모바일에서 PWA 로 사용하는 단계별 가이드.

---

## 1. Vercel 계정 + GitHub 연결 (한 번만)

1. <https://vercel.com> 접속 → **Sign Up** → **Continue with GitHub**
2. GitHub 권한 동의 (suki921114-beep 계정으로 로그인되어 있어야 함)

## 2. 프로젝트 import

1. Vercel 대시보드 → **Add New… → Project**
2. **Import Git Repository** 에서 `suki921114-beep/my-knitting-log` 선택 → **Import**
3. 설정:
   - **Framework Preset**: `Vite` (자동 감지됨)
   - **Build Command**: `npm run build` (기본값)
   - **Output Directory**: `dist` (기본값)
   - **Install Command**: `npm install` (기본값)
   - **Node Version**: 20.x (기본값 OK)
4. **Deploy** 클릭

약 1~2 분 후 `https://my-knitting-log-XXXX.vercel.app` 같은 도메인이 발급됩니다.
(XXXX 는 자동 생성되는 hash. main 브랜치에 push 할 때마다 자동 재배포됨.)

## 3. Firebase Authorized domains 등록 (필수)

배포 직후 모바일에서 Google 로그인하면 **`auth/unauthorized-domain`** 오류가 납니다.
Firebase 가 새 도메인을 모르기 때문에 명시적으로 허용해야 합니다.

1. <https://console.firebase.google.com> → `my-knitting-log` 프로젝트
2. 왼쪽 메뉴 → **Build → Authentication**
3. 상단 탭 → **Settings**
4. **Authorized domains** 섹션 → **Add domain**
5. Vercel 이 발급한 도메인 입력 (예: `my-knitting-log-suki921114-beep.vercel.app`)
6. 같은 방식으로 추가 도메인도 등록 (preview 빌드용 `*.vercel.app` 같은 wildcard 는 지원 안 됨 — 매번 등록)

> 나중에 커스텀 도메인 (`yarnlog.com` 등) 을 연결하면 그것도 같은 곳에 등록.

## 4. 모바일에서 PWA 설치

### iOS (Safari)
1. Safari 로 배포된 URL 접속
2. 하단 공유 버튼 (□↑) → **홈 화면에 추가**
3. 이름 확인 → **추가**
4. 홈 화면에 아이콘 생성 → 탭하면 standalone 으로 실행 (주소창 없음)

### Android (Chrome)
1. Chrome 으로 배포된 URL 접속
2. 주소창에 'PWA 설치' 배너가 뜨거나 메뉴 (⋮) → **앱 설치**
3. 홈 화면 아이콘 생성

## 5. 배포 후 체크리스트

배포 후 다음 시나리오를 한 번씩 돌려보세요.

### 5-1. 기본 동작
- [ ] URL 접속 → 홈 화면이 정상 표시
- [ ] 라이브러리 / 프로젝트 / 설정 페이지 이동
- [ ] 새 프로젝트 / 실 / 도안 추가 → 로컬 저장 확인

### 5-2. Google 로그인
- [ ] 설정 페이지 → '계정 연결 (로그인)'
- [ ] Google 팝업 → 계정 선택 → 로그인 성공
- [ ] 설정 화면 상단에 프로필 + '연결됨' 표시

### 5-3. 클라우드 동기화
- [ ] 설정 → '백업' → 단계별 토스트 (실/도안/바늘/부자재/프로젝트)
- [ ] 마지막 결과 카드에 카운트 표시
- [ ] 다른 기기 (또는 시크릿 창) 에서 같은 계정 로그인 → '가져오기' → 데이터 받아짐

### 5-4. 자동 백업
- [ ] 설정 → '자동 백업' → 'Wi-Fi에서만' 또는 '항상' 선택
- [ ] 단수 카운터 +1 빠르게 5번 → 약 3~5초 후 '자동 백업 완료' 토스트
- [ ] 라이브러리 항목 수정 → 약 15초 후 자동 백업

### 5-5. PWA / 오프라인
- [ ] 브라우저 DevTools → Application 탭 → Service Worker 활성화 확인
- [ ] Network 탭 'Offline' 체크 → 새로고침 → 앱 shell 정상 + 상단 amber 배너
- [ ] 오프라인 상태에서 설정 → '백업' 누르면 '오프라인 상태예요' 토스트
- [ ] 온라인 복귀 → 배너 사라짐 → dirty 있으면 자동 백업 트리거
- [ ] 모바일에서 '홈 화면에 추가' → standalone 으로 실행

### 5-6. soft delete / 휴지통
- [ ] 실 [삭제] → 토스트 '삭제됨 / 되돌리기'
- [ ] 라이브러리 목록에서 사라짐
- [ ] 설정 → '휴지통' → 카운트 배지 + 항목 보임
- [ ] [복원] → 다시 라이브러리에 보임
- [ ] [영구 삭제] → confirm → 휴지통에서 제거 + 다른 기기에서도 부활 안 함

## 6. 문제 발생 시

### 6-1. 빌드 실패
Vercel 대시보드 → 해당 deployment → Build Logs 확인.
TypeScript 에러면 로컬에서 `npm run build` 로 재현 후 수정.

### 6-2. Google 로그인 unauthorized-domain
Firebase Console → Authentication → Settings → Authorized domains 에 도메인 추가.

### 6-3. 새 배포 후 옛 화면이 계속 보임
Service Worker 캐시 문제. 브라우저에서:
- DevTools → Application → Service Workers → **Unregister**
- DevTools → Application → Storage → **Clear site data**

또는 사용자 입장에서는 그냥 **앱 강제 종료 후 재시작** 해도 sw.js 의 `Cache-Control: no-cache` 때문에 옛 SW 가 곧 갱신됩니다.

### 6-4. PWA 가 standalone 으로 안 열림 (브라우저로 열림)
- iOS Safari 는 'PWA 설치' 표준이 아니라 '홈 화면에 추가'. 정상 동작.
- Android Chrome 에서 안 뜨면: HTTPS 인지 확인 (Vercel 은 자동 HTTPS), manifest.webmanifest 가 200 응답인지 확인 (DevTools → Network).

## 7. 다음 단계

- 커스텀 도메인 연결 (예: `yarnlog.com`): Vercel → Project → Settings → Domains
- PWA 아이콘 보강: `public/icon-192.png`, `public/icon-512.png` 추가 후 manifest 업데이트
- 클라우드 묘비 정리: 영구 삭제 시 Firestore docRef 도 함께 삭제
- Firebase Storage 기반 이미지 동기화
