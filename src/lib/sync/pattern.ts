// ----------------------------------------------------------------------------
// Pattern (도안) 동기화
// ----------------------------------------------------------------------------
// 동작은 기존 src/lib/sync.ts 와 동일.

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { firestore } from '../firebase';
import { db } from '@/lib/db';
import type { Pattern } from '@/lib/db';
import { sanitizeForFirestore, type FetchDiff, type SyncDiff } from './common';

export async function calculatePatternSyncDiff(userId: string): Promise<SyncDiff<Pattern>> {
  const diff: SyncDiff<Pattern> = { toUpload: [], toDownload: [], unchanged: 0 };

  const localPatterns = await db.patterns.toArray();
  const localMap = new Map(localPatterns.map(p => [p.cloudId!, p]));

  const patternsRef = collection(firestore, `users/${userId}/patterns`);
  const snapshot = await getDocs(patternsRef);
  const remotePatterns = snapshot.docs.map(d => d.data() as Pattern);
  const remoteMap = new Map(remotePatterns.map(p => [p.cloudId!, p]));

  for (const local of localPatterns) {
    const remote = remoteMap.get(local.cloudId!);
    if (!remote) {
      diff.toUpload.push(local);
    } else {
      if (local.updatedAt > remote.updatedAt) {
        diff.toUpload.push(local);
      } else if (local.updatedAt < remote.updatedAt) {
        diff.toDownload.push(remote);
      } else {
        diff.unchanged++;
      }
    }
  }

  for (const remote of remotePatterns) {
    if (!localMap.has(remote.cloudId!)) {
      diff.toDownload.push(remote);
    }
  }

  return diff;
}

/**
 * @param force true 면 updatedAt 비교를 건너뛰고 클라우드 내용으로 덮어쓴다.
 *              '클라우드 상태로 되돌리기' 전용 — 일반 가져오기는 false.
 */
export async function calculatePatternFetchDiff(userId: string, force = false): Promise<FetchDiff<Pattern>> {
  const diff: FetchDiff<Pattern> = { toAdd: [], toUpdate: [], unchanged: 0 };

  const localPatterns = await db.patterns.toArray();
  const localMap = new Map(localPatterns.map(p => [p.cloudId!, p]));

  const patternsRef = collection(firestore, `users/${userId}/patterns`);
  const snapshot = await getDocs(patternsRef);
  const remotePatterns = snapshot.docs.map(d => d.data() as Pattern);

  for (const remote of remotePatterns) {
    if (!remote.cloudId) continue;

    const local = localMap.get(remote.cloudId);
    if (!local) {
      diff.toAdd.push(remote);
    } else if (force || (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
      diff.toUpdate.push(remote);
    } else {
      // 로컬이 더 최신이면 그대로 둔다 (방금 쓴 기록이 옛 값으로 덮이지 않도록)
      diff.unchanged++;
    }
  }

  return diff;
}

export async function executePatternSync(userId: string, diff: SyncDiff<Pattern>) {
  let uploaded = 0;
  let downloaded = 0;
  let failed = 0;

  try {
    const batch = writeBatch(firestore);
    for (const local of diff.toUpload) {
      try {
        let needsLocalUpdate = false;
        const fixUpdates: any = {};

        if (!local.cloudId) {
          local.cloudId = crypto.randomUUID();
          fixUpdates.cloudId = local.cloudId;
          needsLocalUpdate = true;
        }

        if (!local.updatedAt || isNaN(local.updatedAt)) {
          local.updatedAt = Date.now();
          fixUpdates.updatedAt = local.updatedAt;
          needsLocalUpdate = true;
        }

        if (needsLocalUpdate && local.id) {
          await db.patterns.update(local.id, fixUpdates);
        }

        const docRef = doc(firestore, `users/${userId}/patterns`, local.cloudId!);
        const uploadData = sanitizeForFirestore(local);

        console.log(`[Sync Upload] 도안 대상: ${local.name || 'Unknown'}`);
        batch.set(docRef, uploadData);
        uploaded++;
      } catch (e) {
        console.error(`[Sync] Pattern 업로드 준비 실패: ${local.name || 'Unknown'} (${local.cloudId})`, e);
        failed++;
      }
    }

    try {
      await batch.commit();
    } catch (batchError) {
      console.error("[Sync] Firestore Batch Commit 실패 (Pattern):", batchError);
      failed += uploaded;
      uploaded = 0;
    }

    for (const remote of diff.toDownload) {
      try {
        const existing = await db.patterns.where('cloudId').equals(remote.cloudId!).first();
        if (existing) {
          await db.patterns.update(existing.id!, {
            ...remote,
            id: existing.id,
            imageDataUrl: existing.imageDataUrl,
            fileDataUrl: existing.fileDataUrl
          });
        } else {
          const { id, ...dataToPut } = remote as any;
          await db.patterns.add(dataToPut);
        }
        downloaded++;
      } catch(e) {
        console.error(`[Sync] Pattern 다운로드/저장 실패: ${remote.name || 'Unknown'} (${remote.cloudId})`, e);
        failed++;
      }
    }

    return { uploaded, downloaded, unchanged: diff.unchanged, failed };
  } catch (error) {
    console.error("Pattern Sync execution error:", error);
    throw error;
  }
}

export async function executePatternFetch(diff: FetchDiff<Pattern>) {
  let added = 0;
  let updated = 0;
  let failed = 0;

  for (const remote of diff.toAdd) {
    try {
      const { id, ...dataToPut } = remote as any;
      await db.patterns.add(dataToPut);
      added++;
    } catch (e) {
      console.error(`[Fetch] Pattern 추가 실패: ${remote.name} (${remote.cloudId})`, e);
      failed++;
    }
  }

  for (const remote of diff.toUpdate) {
    try {
      const existing = await db.patterns.where('cloudId').equals(remote.cloudId!).first();
      if (existing) {
        await db.patterns.update(existing.id!, {
          ...remote,
          id: existing.id,
          imageDataUrl: existing.imageDataUrl,
          fileDataUrl: existing.fileDataUrl
        });
        updated++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error(`[Fetch] Pattern 덮어쓰기 실패: ${remote.name} (${remote.cloudId})`, e);
      failed++;
    }
  }

  return { added, updated, unchanged: diff.unchanged, failed };
}
