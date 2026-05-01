// ----------------------------------------------------------------------------
// inAppBrowser — 인앱 브라우저 감지
// ----------------------------------------------------------------------------
// 네이버/카카오톡/인스타그램/페이스북/라인/다음/Android WebView 같은 인앱
// 브라우저는 Google OAuth 로그인을 차단(disallowed_useragent)하는 경우가 많다.
// 이 헬퍼는 단순 userAgent 매칭으로 가장 흔한 케이스만 잡아 사용자에게 Chrome/
// Safari 로 열어달라고 안내할 수 있게 한다.
//
// 정확한 분류는 어렵고 false positive/negative 가능성이 있으므로 화면에서는
// "차단" 이 아니라 "안내" 로만 사용한다.

export type InAppBrowserInfo = {
  detected: boolean;
  /** 감지된 인앱 브라우저 이름 (사용자에게 보여줄 라벨) */
  name?: string;
};

const PATTERNS: Array<[RegExp, string]> = [
  [/NAVER\(inapp/i, 'NAVER'],
  [/Whale\/.*Mobile.*NAVER/i, 'NAVER'],
  [/NAVER/i, 'NAVER'],
  [/KAKAOTALK/i, 'KakaoTalk'],
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FBIOS/i, 'Facebook'],
  [/Line\//i, 'LINE'],
  [/DaumApps/i, 'Daum'],
  // Twitter / X 인앱
  [/Twitter/i, 'X (Twitter)'],
  // 일반 Android WebView (인앱 브라우저 대부분이 ; wv) 패턴 포함)
  [/; wv\)/i, '인앱 브라우저'],
];

export function detectInAppBrowser(): InAppBrowserInfo {
  if (typeof navigator === 'undefined') return { detected: false };
  const ua = navigator.userAgent || '';
  if (!ua) return { detected: false };

  for (const [pattern, name] of PATTERNS) {
    if (pattern.test(ua)) return { detected: true, name };
  }
  return { detected: false };
}
