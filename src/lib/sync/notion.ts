// ----------------------------------------------------------------------------
// Notion (부자재) 동기화
// ----------------------------------------------------------------------------
// 동작은 기존 src/lib/sync.ts 와 동일.

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { firestore } from '../firebase';
import { db } from '@/lib/db';
import type { Notion } from '@/lib/db';
import {
  sanitizeForFirestore,
  type FetchDiff,
  type FetchResult,
  type SyncDiff,
  type SyncResult,
} from './common';

export async function calculateNotionSyncDiff(userId: string): Promise<SyncDiff<Notion>> {
  const diff: SyncDiff<Notion> = { toUpload: [], toDownload: [], unchanged: 0 };

  const localNotions = await db.notions.toArray();
  const localMap = new Map(localNotions.map(n => [n.cloudId!, n]));

  const notionsRef = collection(firestore, `users/${userId}/notions`);
  const snapshot = await getDocs(notionsRef);
  const remoteNotions = snapshot.docs.map(d => d.data() as Notion);
  const remoteMap = new Map(remoteNotions.map(n => [n.cloudId!, n]));

  for (const local of localNotions) {
    const remote = remoteMap.get(local.cloudId!);
    if (!remote) {
      diff.toUpload.push(local);
    } else {
      if ((local.updatedAt ?? 0) > (remote.updatedAt ?? 0)) {
        diff.toUpload.push(local);
      } else if ((local.updatedAt ?? 0) < (remote.updatedAt ?? 0)) {
        diff.toDownload.push(remote);
      } else {
        diff.unchanged++;
      }
    }
  }

  for (const remote of remoteNotions) {
    if (!localMap.has(remote.cloudId!)) {
      diff.toDownload.push(remote);
    }
  }

  return diff;
}

export async function calculateNotionFetchDiff(userId: string): Promise<FetchDiff<Notion>> {
  const diff: FetchDiff<Notion> = { toAdd: [], toUpdate: [], unchanged: 0 };

  const localNotions = await db.notions.toArray();
  const localMap = new Map(localNotions.map(n => [n.cloudId!, n]));

  const notionsRef = collection(firestore, `users/${userId}/notions`);
  const snapshot = await getDocs(notionsRef);
  const remoteNotions = snapshot.docs.map(d => d.data() as Notion);

  for (const remote of remoteNotions) {
    if (!remote.cloudId) continue;

    const local = localMap.get(remote.cloudId);

    if (!local) {
      diff.toAdd.push(remote);
    } else if ((remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
      diff.toUpdate.push(remote);
    } else {
      diff.unchanged++;
    }
  }

  return diff;
}

export async function executeNotionSync(userId: string, diff: SyncDiff<Notion>): Promise<SyncResult> {
  let uploaded = 0;
  let downloaded = 0;
  let failed = 0;

  try {
    const batch = writeBatch(firestore);

    for (const local of diff.toUpload) {
      try {
        let needsLocalUpdate = false;
        const fixUpdates: Partial<Notion> = {};

        if (!local.cloudId) {
          local.cloudId = crypto.randomUUID();
          fixUpdates.cloudId = local.cloudId;
          needsLocalUpdate = true;
        }

        if (!local.updatedAt || Number.isNaN(local.updatedAt)) {
          local.updatedAt = Date.now();
          fixUpdates.updatedAt = local.updatedAt;
          needsLocalUpdate = true;
        }

        if (needsLocalUpdate && local.id) {
          await db.notions.update(local.id, fixUpdates);
        }

        const docRef = doc(firestore, `users/${userId}/notions`, local.cloudId!);
        const uploadData = sanitizeForFirestore(local);

        console.log(`[Sync Upload] 부자재 대상: ${local.name || 'Unknown'}`);
        console.log(`  - cloudId: ${local.cloudId}`);
        console.log(`  - updatedAt: ${local.updatedAt}`);
        console.log(`  - payload:`, uploadData);

        batch.set(docRef, uploadData);
        uploaded++;
      } catch (e) {
        console.error(`[Sync] Notion 업로드 준비 실패: ${local.name || 'Unknown'} (${local.cloudId})`, e);
        failed++;
      }
    }

    try {
      await batch.commit();
    } catch (batchError) {
      console.error("[Sync] Firestore Batch Commit 실패 (Notion):", batchError);
      failed += uploaded;
      uploaded = 0;
    }

    for (const remote of diff.toDownload) {
      try {
        const existing = await db.notions.where('cloudId').equals(remote.cloudId!).first();
        if (existing) {
          await db.notions.update(existing.id!, {
            ...remote,
            id: existing.id,
          });
        } else {
          const { id, ...dataToPut } = remote as any;
          await db.notions.add(dataToPut);
        }
        downloaded++;
      } catch (e) {
        console.error(`[Sync] Notion 다운로드/저장 실패: ${remote.name || 'Unknown'} (${remote.cloudId})`, e);
        failed++;
      }
    }

    return { uploaded, downloaded, unchanged: diff.unchanged, failed };
  } catch (error) {
    console.error("Notion Sync execution error:", error);
    throw error;
  }
}

export async function executeNotionFetch(diff: FetchDiff<Notion>): Promise<FetchResult> {
  let added = 0;
  let updated = 0;
  let failed = 0;

  for (const remote of diff.toAdd) {
    try {
      const { id, ...dataToPut } = remote as any;
      await db.notions.add(dataToPut);
      added++;
    } catch (e) {
      console.error(`[Fetch] Notion 추가 실패: ${remote.name || 'Unknown'} (${remote.cloudId})`, e);
      failed++;
    }
  }

  for (const remote of diff.toUpdate) {
    try {
      const existing = await db.notions.where('cloudId').equals(remote.cloudId!).first();
      if (existing) {
        await db.notions.update(existing.id!, {
          ...remote,
          id: existing.id,
        });
        updated++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error(`[Fetch] Notion 덮어쓰기 실패: ${remote.name || 'Unknown'} (${remote.cloudId})`, e);
      failed++;
    }
  }

  return { added, updated, unchanged: diff.unchanged, failed };
}
