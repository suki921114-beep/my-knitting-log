// ----------------------------------------------------------------------------
// 클라우드 사진 사용량 문서
// ----------------------------------------------------------------------------
// 경로: users/{uid}/meta/storageUsage
//
// Storage 보안 규칙이 이 문서를 읽어 총량 상한을 적용한다(storage.rules).
// 장당 크기 제한은 규칙에서 완전히 강제되지만, 총량은 이 문서에 기대므로
// 규칙에서 "사용량을 줄이려면 사진 수도 함께 줄어야 한다"는 조건을 걸어
// 임의로 0 으로 되돌리는 것을 막는다. 그래도 완전한 방어는 아니어서,
// 최종 안전장치는 Google Cloud 예산 알림이다. (docs/photo-cloud-backup.md)

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import { EMPTY_USAGE, type StorageUsage, type UploadRejection } from './quota';

// ----------------------------------------------------------------------------
// 이번 백업에서 건너뛴 사진 알리기
// ----------------------------------------------------------------------------
// 업로드를 건너뛰는 판단은 sync/project.ts 깊은 곳에서 일어나는데, 그 사실을
// 사용자에게 알려야 하는 곳은 백업 화면이다. 결과 타입(SyncResult)을 건드리지
// 않고 전달하기 위해 짧게 보관했다가 한 번 읽으면 비운다.

let skipped: { count: number; reason: UploadRejection } | null = null;

export function reportSkippedPhoto(reason: UploadRejection) {
  if (skipped && skipped.reason === reason) skipped.count += 1;
  else skipped = { count: 1, reason };
}

/** 읽고 비운다 — 백업이 끝난 직후 한 번만 호출할 것 */
export function takeSkippedPhotos() {
  const value = skipped;
  skipped = null;
  return value;
}

// 가져오기에서 받지 못한 사진 — 조용히 넘어가면 사용자는 사진이 없는 줄 안다
let failedDownloads = 0;

export function reportFailedPhotoDownload() {
  failedDownloads += 1;
}

/** 읽고 비운다 — 가져오기가 끝난 직후 한 번만 호출할 것 */
export function takeFailedPhotoDownloads(): number {
  const value = failedDownloads;
  failedDownloads = 0;
  return value;
}

function usageRef(uid: string) {
  return doc(firestore, `users/${uid}/meta/storageUsage`);
}

/** 없거나 읽지 못하면 빈 사용량 — 백업 자체를 막지는 않는다 */
export async function readUsage(uid: string): Promise<StorageUsage> {
  try {
    const snap = await getDoc(usageRef(uid));
    if (!snap.exists()) return { ...EMPTY_USAGE };
    const data = snap.data() as Partial<StorageUsage>;
    return {
      bytes: Number(data.bytes) || 0,
      photoCount: Number(data.photoCount) || 0,
      updatedAt: Number(data.updatedAt) || 0,
    };
  } catch (error) {
    console.warn('[cloudUsage] 사용량을 읽지 못했습니다:', error);
    return { ...EMPTY_USAGE };
  }
}

export async function writeUsage(uid: string, usage: StorageUsage): Promise<void> {
  await setDoc(usageRef(uid), {
    bytes: Math.max(0, Math.round(usage.bytes)),
    photoCount: Math.max(0, Math.round(usage.photoCount)),
    updatedAt: Date.now(),
  });
}
