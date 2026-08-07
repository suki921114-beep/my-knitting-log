// ----------------------------------------------------------------------------
// Pattern (도안) 동기화
// ----------------------------------------------------------------------------
// 동작은 기존 src/lib/sync.ts 와 동일.

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { firestore } from '../firebase';
import { db } from '@/lib/db';
import type { Pattern } from '@/lib/db';
import { sanitizeForFirestore, type FetchDiff, type SyncDiff } from './common';
import { prepareCoverUpload, resolveCover, needsCoverMigration, PATTERN_COVER } from './coverSync';
import { readUsage, writeUsage } from '@/lib/cloudUsage';
import { EMPTY_USAGE, type StorageUsage } from '@/lib/quota';

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
        // 시각은 같지만 사진이 아직 문서 안에 박혀 있으면 한 번 더 올려 옮긴다
        if (needsCoverMigration(local, remote, PATTERN_COVER)) {
          diff.toUpload.push(local);
        } else {
          diff.unchanged++;
        }
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
    // 클라우드에서 '삭제됨' 인데 이 기기에 없다면 받아올 이유가 없다.
    // (예전에는 그대로 추가해서, 휴지통을 비운 뒤 가져오기를 하면 되살아났다.
    //  새 기기에 남의 휴지통이 딸려 오는 것도 막는다)
    if (remote.isDeleted && !local) {
      diff.unchanged++;
      continue;
    }

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

  // 대표 이미지는 Storage 로 보내고 문서에는 위치만 적는다.
  // 문서에 그림을 박으면 1MB 한도에 걸려 저장이 통째로 실패한다.
  let usage: StorageUsage = diff.toUpload.length ? await readUsage(userId) : { ...EMPTY_USAGE };
  let usageChanged = false;

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

        const prepared = await prepareCoverUpload(userId, local, PATTERN_COVER, usage, 'PatternSync');
        usage = prepared.usage;
        usageChanged = usageChanged || prepared.usageChanged;
        // Storage 위치를 기기에도 적어 둔다 — 안 적으면 다음 백업에 같은 사진을
        // 또 올려 용량만 두 배로 먹는다.
        if (prepared.localPatch && local.id) {
          await db.patterns.update(local.id, prepared.localPatch as any);
          Object.assign(local, prepared.localPatch);
        }

        const docRef = doc(firestore, `users/${userId}/patterns`, local.cloudId!);
        const uploadData = sanitizeForFirestore(prepared.payload);

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

    if (usageChanged) {
      try {
        await writeUsage(userId, usage);
      } catch (e) {
        // 사용량 기록이 실패해도 사진은 이미 올라갔다. 다음 백업에서 다시 맞춰진다.
        console.warn('[Sync] 사용량 기록 실패:', e);
      }
    }

    for (const remote of diff.toDownload) {
      try {
        const existing = await db.patterns.where('cloudId').equals(remote.cloudId!).first();
        // 기기에 그림이 없으면 Storage 에서 받아온다.
        // 예전에 문서 안에 글자로 박아 올린 사진도 그대로 읽어 준다.
        const imageDataUrl = await resolveCover(existing?.imageDataUrl, remote, PATTERN_COVER, 'PatternSync');
        if (existing) {
          await db.patterns.update(existing.id!, {
            ...remote,
            id: existing.id,
            imageDataUrl,
            fileDataUrl: existing.fileDataUrl
          });
        } else {
          const { id, ...dataToPut } = remote as any;
          await db.patterns.add({ ...dataToPut, imageDataUrl });
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
      const imageDataUrl = await resolveCover(undefined, remote, PATTERN_COVER, 'PatternFetch');
      await db.patterns.add({ ...dataToPut, imageDataUrl });
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
        const imageDataUrl = await resolveCover(existing.imageDataUrl, remote, PATTERN_COVER, 'PatternFetch');
        await db.patterns.update(existing.id!, {
          ...remote,
          id: existing.id,
          imageDataUrl,
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
