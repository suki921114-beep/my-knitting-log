// ----------------------------------------------------------------------------
// 클라우드 백업 이용 권한
// ----------------------------------------------------------------------------
// 클라우드 백업은 유료로 가기로 했다. 사진과 기록을 남의 서버에 맡아 두는 일이라
// 사람이 늘수록 실제로 돈이 나간다 (1인당 1GB 상한 × 사람 수).
//
// 지금은 결제 시스템을 붙이지 않고 이름표(이메일)로만 연다.
// 쓰는 사람이 손에 꼽는 동안은 이게 가장 적은 품으로 되는 방법이다.
//
// ⚠️ 이건 잠금장치가 아니라 가림막이다.
//    앱을 뜯으면 화면은 열 수 있다. 다만 실제 방어는 Firestore·Storage 규칙이
//    맡고 있고(자기 경로만 읽고 쓸 수 있다), 1인당 용량 상한도 걸려 있다.
//    그래서 우회해 봐야 남의 기록에 손댈 수는 없고 자기 몫만 쓰게 된다.
//
// 제대로 막아야 할 때가 오면 — 사람이 늘거나 돈을 실제로 받기 시작하면 —
// 여기 판단을 그대로 두고 규칙 쪽에 같은 명단을 얹으면 된다. 화면 코드는
// 손대지 않아도 된다.
//
// 명단을 고치면 앱을 새로 배포해야 반영된다. 자주 바뀔 것 같으면 Firestore 에
// 명단 문서를 두고 읽는 쪽으로 옮기면 되지만, 지금은 그럴 만큼 잦지 않다.

/**
 * 클라우드 백업을 쓸 수 있는 계정.
 *
 * 반드시 소문자로 적을 것 — 비교하기 전에 양쪽을 소문자로 맞추지만,
 * 여기에 대문자가 섞여 있으면 눈으로 볼 때 헷갈린다.
 */
const PRO_EMAILS: readonly string[] = [
  'suki921114@gmail.com',
];

/** 비교하기 좋게 다듬는다 — 앞뒤 공백과 대소문자는 무시한다 */
function normalize(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * 이 계정이 클라우드 백업을 쓸 수 있는지.
 *
 * 로그인하지 않았으면 언제나 false — 누구의 저장 공간인지 알 수 없으니
 * 열어 줄 수가 없다.
 */
export function isProAccount(user?: { email?: string | null } | null): boolean {
  const email = normalize(user?.email);
  if (!email) return false;
  return PRO_EMAILS.includes(email);
}

/** 화면에 보여줄 이메일 — 신청할 때 이 주소를 알려 달라고 해야 한다 */
export function accountEmail(user?: { email?: string | null } | null): string {
  return normalize(user?.email);
}

/** 문의를 받을 곳. 의견 보내기와 같은 창구를 쓴다. */
export const PRO_CONTACT_PATH = '/settings/bug-report';
