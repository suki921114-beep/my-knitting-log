// ----------------------------------------------------------------------------
// 계정 삭제 (탈퇴)
// ----------------------------------------------------------------------------
// Google Play 데이터 삭제 정책상, 로그인 기능이 있는 앱은 앱 안에서 계정과
// 데이터를 지울 수 있는 경로를 제공해야 한다.
//
// 삭제 순서 (중간에 실패해도 다음 단계로 넘어가지 않도록 순차 처리):
//   1) Firestore users/{uid} 하위 문서 전부 삭제
//   2) Firebase Auth 계정 삭제 (필요 시 재인증)
//   3) 로컬 Dexie 데이터 삭제 (선택 — 사용자가 고를 수 있음)
//
// 2번이 최근 로그인을 요구하면(auth/requires-recent-login) 재인증 후 재시도한다.

import { collection, deleteDoc, getDocs, doc } from 'firebase/firestore';
import {
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth, firestore, googleProvider } from '@/lib/firebase';
import { clearAll } from '@/lib/db';

/** users/{uid} 하위에서 삭제할 컬렉션 목록 — sync 모듈이 쓰는 경로와 동일 */
const USER_COLLECTIONS = ['yarns', 'patterns', 'needles', 'notions', 'projects'] as const;

export type DeleteAccountProgress = (message: string) => void;

export interface DeleteAccountOptions {
  /** 이 기기의 로컬 데이터도 함께 지울지 (기본 true) */
  alsoClearLocal?: boolean;
  /** 진행 상황 알림 (UI 표시용) */
  onProgress?: DeleteAccountProgress;
}

export class ReauthRequiredError extends Error {
  constructor() {
    super('재인증이 필요합니다.');
    this.name = 'ReauthRequiredError';
  }
}

/**
 * 클라우드에 저장된 내 데이터 전부 삭제.
 * Auth 계정을 지우기 전에 먼저 호출해야 한다 — 계정이 사라지면 규칙상
 * 본인 데이터에도 접근할 수 없어 문서가 영구히 남는다.
 */
export async function deleteCloudData(uid: string, onProgress?: DeleteAccountProgress) {
  for (const name of USER_COLLECTIONS) {
    onProgress?.(`클라우드 ${name} 삭제 중…`);
    const snap = await getDocs(collection(firestore, `users/${uid}/${name}`));
    // 배치(500 제한) 대신 순차 삭제 — 개인 사용자 규모에서는 충분하고
    // 중간 실패 시 어디까지 지웠는지 파악하기 쉽다.
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  }
  onProgress?.('클라우드 사용자 문서 삭제 중…');
  try {
    await deleteDoc(doc(firestore, 'users', uid));
  } catch {
    // users/{uid} 문서 자체는 없을 수 있다 (하위 컬렉션만 쓰는 구조) — 무시
  }
}

/** Google 재인증 — 최근 로그인 요구 시 사용 */
export async function reauthenticate(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 상태가 아닙니다.');

  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;
    const accessToken = result.credential?.accessToken;
    if (!idToken && !accessToken) {
      throw new Error('Google 인증 토큰을 가져오지 못했습니다.');
    }
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    await reauthenticateWithCredential(user, credential);
    return;
  }

  await reauthenticateWithPopup(user, googleProvider);
}

/**
 * 계정과 데이터를 삭제한다.
 * 재인증이 필요하면 ReauthRequiredError 를 던지므로, 호출부에서
 * reauthenticate() 후 다시 호출하면 된다.
 */
export async function deleteAccount(opts: DeleteAccountOptions = {}): Promise<void> {
  const { alsoClearLocal = true, onProgress } = opts;
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 상태가 아닙니다.');

  // 1) 클라우드 데이터 먼저
  await deleteCloudData(user.uid, onProgress);

  // 2) Auth 계정
  onProgress?.('계정 삭제 중…');
  try {
    await deleteUser(user);
  } catch (e: any) {
    if (e?.code === 'auth/requires-recent-login') {
      throw new ReauthRequiredError();
    }
    throw e;
  }

  // 3) 네이티브 세션 정리 (실패해도 계정은 이미 삭제됨)
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch (e) {
      console.warn('[deleteAccount] 네이티브 signOut 실패(무시):', e);
    }
  }

  // 4) 로컬 데이터
  if (alsoClearLocal) {
    onProgress?.('이 기기의 데이터 삭제 중…');
    await clearAll();
  }
}
