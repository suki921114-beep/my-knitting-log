// 앱 버전 — About 화면과 버그 신고 양쪽에서 같은 값을 쓰도록 한 곳에 둔다.
//
// ⚠️ android/app/build.gradle 의 versionName 과 항상 같아야 한다.
//    버그 신고에 찍히는 버전과 스토어 버전이 어긋나면 어느 빌드에서 난
//    오류인지 추적할 수 없다.
//
// 업데이트 절차:
//   1) 이 값과 build.gradle 의 versionName 을 같이 올린다
//   2) build.gradle 의 versionCode 를 +1 한다 (되돌릴 수 없음)
//   3) public/sw.js 의 CACHE 이름도 같은 버전으로 올린다
//      — 안 올리면 웹에서 옛 화면이 계속 나온다
export const APP_VERSION = '1.2.3';

/** 버그 신고에 함께 보낼 환경 정보 */
export function collectEnvInfo() {
  return {
    appVersion: APP_VERSION,
    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    language: typeof navigator !== 'undefined' ? navigator.language : '',
    online: typeof navigator !== 'undefined' ? navigator.onLine : null,
    screen:
      typeof window !== 'undefined'
        ? `${window.screen?.width ?? 0}x${window.screen?.height ?? 0} @${window.devicePixelRatio ?? 1}x`
        : '',
    createdAt: new Date().toISOString(),
  };
}
