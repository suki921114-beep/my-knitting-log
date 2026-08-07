// ----------------------------------------------------------------------------
// Yarn (실) 동기화
// ----------------------------------------------------------------------------
// 동작은 기존 src/lib/sync.ts 와 동일. 함수 시그니처 그대로 유지.

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { firestore } from '../firebase';
import { db } from '@/lib/db';
import type { Yarn } from '@/lib/db';
import { sanitizeForFirestore, type FetchDiff, type SyncDiff } from './common';
import { prepareCoverUpload, resolveCover, YARN_COVER } from './coverSync';
import { readUsage, writeUsage } from '@/lib/cloudUsage';
import { EMPTY_USAGE, type StorageUsage } from '@/lib/quota';

export async function calculateYarnSyncDiff(userId: string): Promise<SyncDiff<Yarn>> {
  const diff: SyncDiff<Yarn> = { toUpload: [], toDownload: [], unchanged: 0 };

  // 1. 로컬 데이터 가져오기
  const localYarns = await db.yarns.toArray();
  const localMap = new Map(localYarns.map(y => [y.cloudId!, y]));

  // 2. 클라우드 데이터 가져오기
  const yarnsRef = collection(firestore, `users/${userId}/yarns`);
  const snapshot = await getDocs(yarnsRef);
  const remoteYarns = snapshot.docs.map(d => d.data() as Yarn);
  const remoteMap = new Map(remoteYarns.map(y => [y.cloudId!, y]));

  // 3. 로컬 기준으로 비교 (업로드 대상, 병합 대상 식별)
  for (const local of localYarns) {
    const remote = remoteMap.get(local.cloudId!);
    if (!remote) {
      // 클라우드에 없으면 업로드
      diff.toUpload.push(local);
    } else {
      // 둘 다 있으면 updatedAt 비교
      if (local.updatedAt > remote.updatedAt) {
        diff.toUpload.push(local);
      } else if (local.updatedAt < remote.updatedAt) {
        diff.toDownload.push(remote);
      } else {
        diff.unchanged++;
      }
    }
  }

  // 4. 클라우드 기준으로 비교 (로컬에 없는 다운로드 대상 식별)
  for (const remote of remoteYarns) {
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
export async function calculateYarnFetchDiff(userId: string, force = false): Promise<FetchDiff<Yarn>> {
  const diff: FetchDiff<Yarn> = { toAdd: [], toUpdate: [], unchanged: 0 };

  const localYarns = await db.yarns.toArray();
  const localMap = new Map(localYarns.map(y => [y.cloudId!, y]));

  const yarnsRef = collection(firestore, `users/${userId}/yarns`);
  const snapshot = await getDocs(yarnsRef);
  const remoteYarns = snapshot.docs.map(d => d.data() as Yarn);

  for (const remote of remoteYarns) {
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
      // 로컬에 없으면 새로 추가
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

export async function executeYarnSync(userId: string, diff: SyncDiff<Yarn>) {
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

        // 1-1. 레거시 데이터 보정 (cloudId 누락)
        if (!local.cloudId) {
          local.cloudId = crypto.randomUUID();
          fixUpdates.cloudId = local.cloudId;
          needsLocalUpdate = true;
        }

        // 1-2. 타임스탬프 보정 (updatedAt 누락 또는 비정상)
        if (!local.updatedAt || isNaN(local.updatedAt)) {
          local.updatedAt = Date.now();
          fixUpdates.updatedAt = local.updatedAt;
          needsLocalUpdate = true;
        }

        // 보정된 데이터가 있으면 로컬 DB 먼저 덮어쓰기
        if (needsLocalUpdate && local.id) {
          await db.yarns.update(local.id, fixUpdates);
        }

        const prepared = await prepareCoverUpload(userId, local, YARN_COVER, usage, 'YarnSync');
        usage = prepared.usage;
        usageChanged = usageChanged || prepared.usageChanged;
        // Storage 위치를 기기에도 적어 둔다 — 안 적으면 다음 백업에 같은 사진을
        // 또 올려 용량만 두 배로 먹는다.
        if (prepared.localPatch && local.id) {
          await db.yarns.update(local.id, prepared.localPatch as any);
          Object.assign(local, prepared.localPatch);
        }

        const docRef = doc(firestore, `users/${userId}/yarns`, local.cloudId!);
        const uploadData = sanitizeForFirestore(prepared.payload);

        console.log(`[Sync Upload] 대상: ${local.name || 'Unknown'}`);
        console.log(`  - cloudId: ${local.cloudId}`);
        console.log(`  - updatedAt: ${local.updatedAt}`);
        console.log(`  - 최종 Payload:`, uploadData);

        batch.set(docRef, uploadData);
        uploaded++;
      } catch (e) {
        console.error(`[Sync] Yarn 업로드 준비 실패: ${local.name || 'Unknown'} (${local.cloudId})`, e);
        failed++;
      }
    }

    try {
      await batch.commit();
    } catch (batchError) {
      console.error("[Sync] Firestore Batch Commit 실패:", batchError);
      // Batch commit fails entirely if one doc is invalid (usually caught earlier, but just in case)
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

    // 2. 로컬(Dexie)로 다운로드 (기존 이미지/id 보존)
    for (const remote of diff.toDownload) {
      try {
        const existing = await db.yarns.where('cloudId').equals(remote.cloudId!).first();
        // 기기에 그림이 없으면 Storage 에서 받아온다.
        // 예전에 문서 안에 글자로 박아 올린 사진도 그대로 읽어 준다.
        const photoDataUrl = await resolveCover(existing?.photoDataUrl, remote, YARN_COVER, 'YarnSync');
        if (existing) {
          await db.yarns.update(existing.id!, { ...remote, id: existing.id, photoDataUrl });
        } else {
          const { id, ...dataToPut } = remote as any;
          await db.yarns.add({ ...dataToPut, photoDataUrl });
        }
        downloaded++;
      } catch(e) {
        console.error(`[Sync] Yarn 다운로드/저장 실패: ${remote.name || 'Unknown'} (${remote.cloudId})`, e);
        failed++;
      }
    }

    return {
      uploaded,
      downloaded,
      unchanged: diff.unchanged,
      failed
    };
  } catch (error) {
    console.error("Sync execution error:", error);
    throw error;
  }
}

export async function executeYarnFetch(diff: FetchDiff<Yarn>) {
  let added = 0;
  let updated = 0;
  let failed = 0;

  // 1. 새 항목 추가
  for (const remote of diff.toAdd) {
    try {
      const { id, ...dataToPut } = remote as any;
      const photoDataUrl = await resolveCover(undefined, remote, YARN_COVER, 'YarnFetch');
      await db.yarns.add({ ...dataToPut, photoDataUrl });
      added++;
    } catch (e) {
      console.error(`[Fetch] Yarn 추가 실패: ${remote.name} (${remote.cloudId})`, e);
      failed++;
    }
  }

  // 2. 기존 항목 덮어쓰기 (이미지와 로컬 id 보존)
  for (const remote of diff.toUpdate) {
    try {
      const existing = await db.yarns.where('cloudId').equals(remote.cloudId!).first();
      if (existing) {
        const photoDataUrl = await resolveCover(existing.photoDataUrl, remote, YARN_COVER, 'YarnFetch');
        await db.yarns.update(existing.id!, { ...remote, id: existing.id, photoDataUrl });
        updated++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error(`[Fetch] Yarn 덮어쓰기 실패: ${remote.name} (${remote.cloudId})`, e);
      failed++;
    }
  }

  return { added, updated, unchanged: diff.unchanged, failed };
}
