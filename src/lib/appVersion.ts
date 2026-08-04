// 앱 버전 — About 화면과 버그 신고 양쪽에서 같은 값을 쓰도록 한 곳에 둔다.
// 출시할 때 android/app/build.gradle 의 versionName 과 함께 올리세요.
export const APP_VERSION = '0.1.0';

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
