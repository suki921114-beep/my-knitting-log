// ----------------------------------------------------------------------------
// Needle (바늘) 동기화
// ----------------------------------------------------------------------------
// 동작은 기존 src/lib/sync.ts 와 동일.

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { firestore } from '../firebase';
import { db } from '@/lib/db';
import type { Needle } from '@/lib/db';
import { sanitizeForFirestore, type FetchDiff, type SyncDiff } from './common';

export async function calculateNeedleSyncDiff(userId: string): Promise<SyncDiff<Needle>> {
  const diff: SyncDiff<Needle> = { toUpload: [], toDownload: [], unchanged: 0 };

  const localNeedles = await db.needles.toArray();
  const localMap = new Map(localNeedles.map(n => [n.cloudId!, n]));

  const needlesRef = collection(firestore, `users/${userId}/needles`);
  const snapshot = await getDocs(needlesRef);
  const remoteNeedles = snapshot.docs.map(d => d.data() as Needle);
  const remoteMap = new Map(remoteNeedles.map(n => [n.cloudId!, n]));

  for (const local of localNeedles) {
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

  for (const remote of remoteNeedles) {
    if (!localMap.has(remote.cloudId!)) {
      diff.toDownload.push(remote);
    }
  }

  return diff;
}

export async function calculateNeedleFetchDiff(userId: string): Promise<FetchDiff<Needle>> {
  const diff: FetchDiff<Needle> = { toAdd: [], toUpdate: [], unchanged: 0 };

  const localNeedles = await db.needles.toArray();
  const localMap = new Map(localNeedles.map(n => [n.cloudId!, n]));

  const needlesRef = collection(firestore, `users/${userId}/needles`);
  const snapshot = await getDocs(needlesRef);
  const remoteNeedles = snapshot.docs.map(d => d.data() as Needle);

  for (const remote of remoteNeedles) {
    if (!remote.cloudId) continue;

    const local = localMap.get(remote.cloudId);
    if (!local) {
      diff.toAdd.push(remote);
    } else {
      if (remote.updatedAt > local.updatedAt) {
        diff.toUpdate.push(remote);
      } else if (remote.updatedAt === local.updatedAt) {
        diff.unchanged++;
      }
    }
  }

  return diff;
}

export async function executeNeedleSync(userId: string, diff: SyncDiff<Needle>) {
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
          await db.needles.update(local.id, fixUpdates);
        }

        const docRef = doc(firestore, `users/${userId}/needles`, local.cloudId!);
        const uploadData = sanitizeForFirestore(local);

        console.log(`[Sync Upload] 바늘 대상: ${local.type || 'Unknown'} (${local.sizeMm})`);
        batch.set(docRef, uploadData);
        uploaded++;
      } catch (e) {
        console.error(`[Sync] Needle 업로드 준비 실패: ${local.type || 'Unknown'} (${local.cloudId})`, e);
        failed++;
      }
    }

    try {
      await batch.commit();
    } catch (batchError) {
      console.error("[Sync] Firestore Batch Commit 실패 (Needle):", batchError);
      failed += uploaded;
      uploaded = 0;
    }

    for (const remote of diff.toDownload) {
      try {
        const existing = await db.needles.where('cloudId').equals(remote.cloudId!).first();
        if (existing) {
          await db.needles.update(existing.id!, {
            ...remote,
            id: existing.id
          });
        } else {
          const { id, ...dataToPut } = remote as any;
          await db.needles.add(dataToPut);
        }
        downloaded++;
      } catch(e) {
        console.error(`[Sync] Needle 다운로드/저장 실패: ${remote.type || 'Unknown'} (${remote.cloudId})`, e);
        failed++;
      }
    }

    return { uploaded, downloaded, unchanged: diff.unchanged, failed };
  } catch (error) {
    console.error("Needle Sync execution error:", error);
    throw error;
  }
}

export async function executeNeedleFetch(diff: FetchDiff<Needle>) {
  let added = 0;
  let updated = 0;
  let failed = 0;

  for (const remote of diff.toAdd) {
    try {
      const { id, ...dataToPut } = remote as any;
      await db.needles.add(dataToPut);
      added++;
    } catch (e) {
      console.error(`[Fetch] Needle 추가 실패: ${remote.type} (${remote.cloudId})`, e);
      failed++;
    }
  }

  for (const remote of diff.toUpdate) {
    try {
      const existing = await db.needles.where('cloudId').equals(remote.cloudId!).first();
      if (existing) {
        await db.needles.update(existing.id!, {
          ...remote,
          id: existing.id
        });
        updated++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error(`[Fetch] Needle 덮어쓰기 실패: ${remote.type} (${remote.cloudId})`, e);
      failed++;
    }
  }

  return { added, updated, unchanged: diff.unchanged, failed };
}
