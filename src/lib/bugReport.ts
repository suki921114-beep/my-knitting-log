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

/** 신고에 함께 보낼 에러 로그 최대 개수 — 문서 크기 제한(1MB) 여유 확보 */
const MAX_LOGS = 20;
/** 스택은 길어질 수 있어 잘라서 보낸다 */
const MAX_STACK = 1200;

export interface BugReportResult {
  ok: boolean;
  reason?: 'not-signed-in' | 'offline' | 'empty' | 'failed';
}

export async function submitBugReport(description: string): Promise<BugReportResult> {
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

  try {
    await addDoc(collection(firestore, 'bugReports'), {
      description: text,
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
