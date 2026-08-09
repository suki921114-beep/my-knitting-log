// ----------------------------------------------------------------------------
// 도안 PDF 동기화
// ----------------------------------------------------------------------------
// 사진과 다른 점이 셋이다.
//
//   1) 아무나 못 쓴다. 신청한 계정만 열린다 (entitlement.ts).
//      한 개가 3~10MB 라 사람이 늘면 보관 비용이 바로 늘어난다.
//
//   2) 문서에는 자리만 적는다. Firestore 문서는 1MB 한도가 있어 PDF 는
//      애초에 들어갈 수 없다.
//
//   3) 짝은 patternCloudId 로 맞춘다. patternId 는 기기 안에서만 통하는
//      번호라, 그걸로 맞추면 폰의 3번 도안 파일이 PC 의 3번(다른 도안)에 붙는다.
//
// 권한이 없는 계정에서는 아무 일도 하지 않는다 — 올리지도, 받지도 않는다.
// 그 계정의 PDF 는 지금까지처럼 기기에만 남는다.

import { db, type Pattern, type PatternFile } from '@/lib/db';
import { isProAccount } from '@/lib/entitlement';
import { auth } from '@/lib/firebase';
import { canUpload, type StorageUsage } from '@/lib/quota';
import { reportSkippedPhoto } from '@/lib/cloudUsage';
import { captureError } from '@/lib/errorLog';
import { ENABLE_CLOUD_PHOTO_SYNC } from '@/lib/featureFlags';
import {
  uploadPatternFile,
  downloadPatternFile,
  deletePatternFileObject,
} from './patternFileStorage';

/** 지금 로그인한 사람이 도안 파일을 클라우드에 둘 수 있는지 */
export function canSyncPatternFiles(): boolean {
  return ENABLE_CLOUD_PHOTO_SYNC && isProAccount(auth.currentUser);
}

export interface PatternFilePayload {
  fileStoragePath?: string;
  fileName?: string;
  fileSize?: number;
}

export interface UploadPatternFileResult {
  /** 문서에 실을 것 */
  payload: PatternFilePayload;
  usage: StorageUsage;
  usageChanged: boolean;
}

/**
 * 이 도안의 PDF 를 올리고, 문서에 적을 값을 만든다.
 *
 * 이미 올라가 있으면 그대로 둔다 — 같은 파일을 두 번 올릴 이유가 없다.
 * 실패해도 throw 하지 않는다. 도안 자체의 백업까지 막히면 안 된다.
 */
export async function uploadPatternFileFor(
  userId: string,
  pattern: Pattern,
  usage: StorageUsage,
  context: string,
): Promise<UploadPatternFileResult> {
  const none: UploadPatternFileResult = { payload: {}, usage, usageChanged: false };
  if (!canSyncPatternFiles() || !pattern.cloudId || pattern.id == null) return none;

  const local = await db.patternFiles.where('patternId').equals(pattern.id).first();
  if (!local) {
    // 기기에 파일이 없다. 클라우드에 있던 것을 지운 경우일 수 있으니
    // 문서의 자리도 함께 비운다.
    return { payload: {}, usage, usageChanged: false };
  }

  // 이미 올라가 있으면 자리만 다시 적어 준다
  if (local.storagePath) {
    return {
      payload: {
        fileStoragePath: local.storagePath,
        fileName: local.name,
        fileSize: local.size,
      },
      usage,
      usageChanged: false,
    };
  }

  const verdict = canUpload(usage, local.size);
  if (!verdict.ok) {
    // 올리지 않을 뿐 기기에는 남는다. 자리가 생기면 다음 백업에서 다시 시도한다.
    reportSkippedPhoto(verdict.reason!);
    return none;
  }

  try {
    const path = await uploadPatternFile(userId, pattern.cloudId, local.blob);
    // 기기에도 자리를 적어 둔다 — 안 적으면 다음 백업에 같은 파일을 또 올린다
    await db.patternFiles.update(local.id!, {
      storagePath: path,
      patternCloudId: pattern.cloudId,
    });
    return {
      payload: { fileStoragePath: path, fileName: local.name, fileSize: local.size },
      usage: { ...usage, bytes: usage.bytes + local.size },
      usageChanged: true,
    };
  } catch (e) {
    console.error(`[${context}] 도안 파일 업로드 실패:`, e);
    captureError(
      `도안 파일 업로드 실패 | ${pattern.cloudId} | ${String((e as Error)?.message ?? e)}`,
      `${context}/patternFileUpload`,
    );
    return none;
  }
}

/**
 * 문서에 적힌 도안 파일을 이 기기로 받아온다.
 *
 * 이미 기기에 있으면 건드리지 않는다. 같은 파일을 두 번 받을 이유가 없고,
 * 받는 동안 쓰던 파일이 사라지면 곤란하다.
 */
export async function downloadPatternFileFor(
  localPatternId: number,
  remote: Pattern,
  context: string,
): Promise<void> {
  if (!canSyncPatternFiles() || !remote.fileStoragePath) return;

  const existing = await db.patternFiles.where('patternId').equals(localPatternId).first();
  if (existing) return;

  try {
    const blob = await downloadPatternFile(remote.fileStoragePath);
    const record: PatternFile = {
      patternId: localPatternId,
      patternCloudId: remote.cloudId,
      name: remote.fileName || '도안.pdf',
      size: remote.fileSize ?? blob.size,
      type: 'application/pdf',
      blob,
      storagePath: remote.fileStoragePath,
      createdAt: Date.now(),
    };
    await db.patternFiles.add(record);
  } catch (e) {
    // 조용히 넘어가면 도안이 원래 없는 줄 안다. 기록은 남긴다.
    console.error(`[${context}] 도안 파일 다운로드 실패:`, remote.fileStoragePath, e);
    captureError(
      `도안 파일 다운로드 실패 | ${remote.fileStoragePath} | ${String((e as Error)?.message ?? e)}`,
      `${context}/patternFileDownload`,
    );
  }
}

/** 도안을 영구 삭제할 때 클라우드에 있는 파일도 함께 지운다 */
export async function purgePatternFileFromCloud(
  userId: string,
  patternCloudId: string,
): Promise<void> {
  if (!canSyncPatternFiles()) return;
  await deletePatternFileObject(`users/${userId}/patternFiles/${patternCloudId}.pdf`);
}
