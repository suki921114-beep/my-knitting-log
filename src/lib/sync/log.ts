// ----------------------------------------------------------------------------
// KnitLog (다이어리 기록) 동기화
// ----------------------------------------------------------------------------
// 다른 entity 와 다른 점이 두 가지 있어 별도 변환을 거친다.
//
// 1) projectId 는 기기마다 다른 자동증가 값이다.
//    기기 A 의 3번 프로젝트와 기기 B 의 3번 프로젝트는 서로 다른 물건이므로
//    그대로 올리면 엉뚱한 프로젝트에 일기가 붙는다.
//    → 클라우드에는 projectCloudId 로 올리고, 내려받을 때 로컬 projectId 로 되돌린다.
//    → 그래서 프로젝트 동기화를 먼저 끝낸 뒤에 호출해야 한다.
//
// 2) photos 는 그림 자체를 문서에 담을 수 없다.
//    글자로 바꾸면 용량이 3분의 1쯤 불어나는데 문서 하나는 1MB 를 못 넘는다.
//    그래서 그림은 Storage 에 올리고 문서에는 '어디에 있는지' 만 적는다.
//    (예전에는 아예 안 올려서, 기기를 바꾸면 다이어리 사진이 사라졌다)

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { firestore } from '../firebase';
import { db } from '@/lib/db';
import type { KnitLog } from '@/lib/db';
import { sanitizeForFirestore, type FetchResult, type SyncResult } from './common';
import { toLocal, toRemote, type RemoteLog } from './logMap';
import { uploadPhotos, downloadPhotos, hasUnuploadedPhotos } from './photoSync';
import { readUsage, writeUsage } from '@/lib/cloudUsage';
import { EMPTY_USAGE, type StorageUsage } from '@/lib/quota';

export * from './logMap';

export interface LogSyncDiff {
  toUpload: KnitLog[];
  toDownload: RemoteLog[];
  unchanged: number;
}

export interface LogFetchDiff {
  toAdd: RemoteLog[];
  toUpdate: RemoteLog[];
  unchanged: number;
}

// ----------------------------------------------------------------------------
// projectId ↔ projectCloudId 매핑 (이 기기 기준)
// ----------------------------------------------------------------------------

async function projectCloudIdByLocalId(): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  for (const p of await db.projects.toArray()) {
    if (p.id != null && p.cloudId) map.set(p.id, p.cloudId);
  }
  return map;
}

async function projectLocalIdByCloudId(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const p of await db.projects.toArray()) {
    if (p.id != null && p.cloudId) map.set(p.cloudId, p.id);
  }
  return map;
}

async function readRemoteLogs(userId: string): Promise<RemoteLog[]> {
  const snapshot = await getDocs(collection(firestore, `users/${userId}/logs`));
  return snapshot.docs.map(d => d.data() as RemoteLog).filter(r => !!r.cloudId);
}

// ----------------------------------------------------------------------------
// 백업 (양방향 비교)
// ----------------------------------------------------------------------------

export async function calculateLogSyncDiff(userId: string): Promise<LogSyncDiff> {
  const diff: LogSyncDiff = { toUpload: [], toDownload: [], unchanged: 0 };

  const localLogs = await db.logs.toArray();
  const localMap = new Map(localLogs.map(l => [l.cloudId!, l]));

  const remoteLogs = await readRemoteLogs(userId);
  const remoteMap = new Map(remoteLogs.map(l => [l.cloudId, l]));

  for (const local of localLogs) {
    const remote = remoteMap.get(local.cloudId!);
    if (!remote) {
      diff.toUpload.push(local);
    } else if ((local.updatedAt ?? 0) > (remote.updatedAt ?? 0)) {
      diff.toUpload.push(local);
    } else if ((local.updatedAt ?? 0) < (remote.updatedAt ?? 0)) {
      diff.toDownload.push(remote);
    } else if (hasUnuploadedPhotos(local.photos)) {
      // 시각은 같지만 사진이 아직 안 올라갔다 — 사진을 안 올리던 시절의 기록
      diff.toUpload.push(local);
    } else {
      diff.unchanged++;
    }
  }

  for (const remote of remoteLogs) {
    if (!localMap.has(remote.cloudId)) diff.toDownload.push(remote);
  }

  return diff;
}

export async function executeLogSync(userId: string, diff: LogSyncDiff): Promise<SyncResult> {
  let uploaded = 0;
  let downloaded = 0;
  let failed = 0;

  const projectCloudIds = await projectCloudIdByLocalId();

  // 사진은 문서를 쓰기 전에 Storage 로 올린다. 올린 뒤라야 '어디에 있는지'를
  // 문서에 적을 수 있다.
  let usage: StorageUsage = diff.toUpload.length ? await readUsage(userId) : { ...EMPTY_USAGE };
  let usageChanged = false;

  const batch = writeBatch(firestore);
  for (const local of diff.toUpload) {
    try {
      const fixUpdates: Partial<KnitLog> = {};
      let needsLocalUpdate = false;

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

      const result = await uploadPhotos(
        userId,
        local.cloudId!,
        local.photos ?? [],
        usage,
        'LogSync',
      );
      usage = result.usage;
      usageChanged = usageChanged || result.usageChanged;
      // storagePath 가 채워진 메타를 기기에도 남긴다 — 안 남기면 다음 백업에
      // 같은 사진을 또 올려 용량만 두 배로 먹는다.
      if (result.usageChanged) {
        fixUpdates.photos = result.photos;
        needsLocalUpdate = true;
      }

      if (needsLocalUpdate && local.id) {
        await db.logs.update(local.id, fixUpdates);
      }

      const docRef = doc(firestore, `users/${userId}/logs`, local.cloudId!);
      batch.set(
        docRef,
        sanitizeForFirestore(toRemote(local, projectCloudIds, result.payloads)),
      );
      uploaded++;
    } catch (e) {
      console.error(`[Sync] 일기 업로드 준비 실패 (${local.cloudId})`, e);
      failed++;
    }
  }

  try {
    await batch.commit();
  } catch (batchError) {
    console.error('[Sync] Firestore Batch Commit 실패 (KnitLog):', batchError);
    failed += uploaded;
    uploaded = 0;
  }

  if (usageChanged) {
    try {
      await writeUsage(userId, usage);
    } catch (e) {
      // 사용량 기록이 실패해도 사진은 이미 올라갔다. 다음 백업에서 다시 맞춰진다.
      console.warn('[Sync] 사용량 기록 실패 (KnitLog):', e);
    }
  }

  const projectIds = await projectLocalIdByCloudId();
  for (const remote of diff.toDownload) {
    try {
      await upsertLocal(remote, projectIds);
      downloaded++;
    } catch (e) {
      console.error(`[Sync] 일기 저장 실패 (${remote.cloudId})`, e);
      failed++;
    }
  }

  return { uploaded, downloaded, unchanged: diff.unchanged, failed };
}

// ----------------------------------------------------------------------------
// 가져오기 (클라우드 → 이 기기)
// ----------------------------------------------------------------------------

/**
 * @param force true 면 updatedAt 비교를 건너뛰고 클라우드 내용으로 덮어쓴다.
 *              '클라우드 상태로 되돌리기' 전용 — 일반 가져오기는 false.
 */
export async function calculateLogFetchDiff(userId: string, force = false): Promise<LogFetchDiff> {
  const diff: LogFetchDiff = { toAdd: [], toUpdate: [], unchanged: 0 };

  const localLogs = await db.logs.toArray();
  const localMap = new Map(localLogs.map(l => [l.cloudId!, l]));

  for (const remote of await readRemoteLogs(userId)) {
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
      diff.unchanged++;
    }
  }

  return diff;
}

export async function executeLogFetch(diff: LogFetchDiff): Promise<FetchResult> {
  let added = 0;
  let updated = 0;
  let failed = 0;

  const projectIds = await projectLocalIdByCloudId();

  for (const remote of diff.toAdd) {
    try {
      await upsertLocal(remote, projectIds);
      added++;
    } catch (e) {
      console.error(`[Fetch] 일기 추가 실패 (${remote.cloudId})`, e);
      failed++;
    }
  }

  for (const remote of diff.toUpdate) {
    try {
      await upsertLocal(remote, projectIds);
      updated++;
    } catch (e) {
      console.error(`[Fetch] 일기 덮어쓰기 실패 (${remote.cloudId})`, e);
      failed++;
    }
  }

  return { added, updated, unchanged: diff.unchanged, failed };
}

/** cloudId 로 로컬 레코드를 찾아 갱신하고, 없으면 추가한다 */
async function upsertLocal(remote: RemoteLog, projectIds: Map<string, number>) {
  const existing = await db.logs.where('cloudId').equals(remote.cloudId).first();

  // ⚠️ 사진 받아오기는 Dexie 트랜잭션 밖에서 해야 한다.
  //    트랜잭션 안에서 네트워크를 기다리면 Dexie 가 트랜잭션을 끊어 버린다.
  //    (프로젝트 동기화에서 같은 실수로 사진이 안 내려온 적이 있다)
  const photos = remote.photos?.length
    ? await downloadPhotos(remote.photos, existing?.photos, 'LogFetch')
    : existing?.photos;

  const data = toLocal(remote, projectIds, photos);

  if (existing?.id != null) {
    await db.logs.update(existing.id, data as any);
  } else {
    await db.logs.add(data as KnitLog);
  }
}
