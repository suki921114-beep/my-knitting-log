// ----------------------------------------------------------------------------
// 버그 신고 전송
// ----------------------------------------------------------------------------
// 사용자가 [보내기] 를 누를 때만 Firestore 에 올린다. 자동 수집은 하지 않는다.
//
// 보안 규칙(firestore.rules): bugReports 는 로그인 사용자만 create 가능하고
// read/update/delete 는 전부 막혀 있다. 남의 신고를 읽을 수 없다.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from '@/lib/firebase';
import { getErrorLogs } from '@/lib/errorLog';
import { collectEnvInfo } from '@/lib/appVersion';
import { OPERATOR_EMAIL } from '@/lib/legalPlaceholders';

// ----------------------------------------------------------------------------
// 메일 알림
// ----------------------------------------------------------------------------
// Firebase 확장 'Trigger Email from Firestore' 는 지정한 컬렉션에 문서가 생기면
// 그 문서의 to / message 필드를 읽어 메일을 보낸다.
// 그래서 신고 문서에 두 필드를 함께 넣어 두면 별도 서버 코드 없이 알림이 온다.
//
// ⚠️ 받는 주소는 클라이언트가 정하는 값이라, 보안 규칙에서 운영자 주소로 고정한다.
//    (firestore.rules 의 bugReports 참고) 그렇지 않으면 아무에게나 메일을
//    보내는 발송기로 쓰일 수 있다.

/** 메일 본문에 넣을 최대 길이 — 문서 크기(1MB) 여유 확보 */
const MAX_MAIL_BODY = 4000;

/** 신고에 함께 보낼 에러 로그 최대 개수 — 문서 크기 제한(1MB) 여유 확보 */
const MAX_LOGS = 20;
/** 스택은 길어질 수 있어 잘라서 보낸다 */
const MAX_STACK = 1200;

export interface BugReportResult {
  ok: boolean;
  reason?: 'not-signed-in' | 'offline' | 'empty' | 'failed';
}

/** 의견 종류 — 버그와 개선 제안을 한 화면에서 받는다 */
export type FeedbackKind = 'bug' | 'idea' | 'etc';

export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = {
  bug: '버그 신고',
  idea: '개선 제안',
  etc: '기타 의견',
};

export async function submitBugReport(
  description: string,
  kind: FeedbackKind = 'bug',
): Promise<BugReportResult> {
  const text = description.trim();
  if (!text) return { ok: false, reason: 'empty' };

  const user = auth.currentUser;
  if (!user) return { ok: false, reason: 'not-signed-in' };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, reason: 'offline' };
  }

  const env = collectEnvInfo();
  const errorLogs = getErrorLogs()
    .slice(0, MAX_LOGS)
    .map(l => ({
      createdAt: l.createdAt,
      message: l.message,
      context: l.context ?? null,
      url: l.url,
      stack: l.stack ? l.stack.slice(0, MAX_STACK) : null,
    }));

  const mailBody = [
    `[${FEEDBACK_KIND_LABEL[kind]}]`,
    '',
    text,
    '',
    '--- 환경 ---',
    `버전: v${env.appVersion}`,
    `보낸 사람: ${user.email ?? user.uid}`,
    `화면: ${env.pageUrl}`,
    `기기: ${env.userAgent}`,
    `해상도: ${env.screen}`,
    '',
    `--- 오류 기록 ${errorLogs.length}개 ---`,
    ...errorLogs.map(l => `${l.createdAt} [${l.context ?? '-'}] ${l.message}`),
  ]
    .join('\n')
    .slice(0, MAX_MAIL_BODY);

  try {
    await addDoc(collection(firestore, 'bugReports'), {
      description: text,
      kind,
      // Trigger Email 확장이 읽는 필드 — 이 두 개가 있어야 메일이 나간다
      to: OPERATOR_EMAIL ? [OPERATOR_EMAIL] : [],
      message: {
        subject: `[뜨개일기 v${env.appVersion}] ${FEEDBACK_KIND_LABEL[kind]}`,
        text: mailBody,
      },
      uid: user.uid,
      email: user.email ?? null,
      appVersion: env.appVersion,
      pageUrl: env.pageUrl,
      userAgent: env.userAgent,
      language: env.language,
      screen: env.screen,
      online: env.online,
      errorLogs,
      clientCreatedAt: env.createdAt,
      createdAt: serverTimestamp(),
      status: 'new',
    });
    return { ok: true };
  } catch (e) {
    console.error('[bugReport] 전송 실패:', e);
    return { ok: false, reason: 'failed' };
  }
}
