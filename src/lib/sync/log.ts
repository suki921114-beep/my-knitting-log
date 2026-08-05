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
// 2) photos 는 base64 dataUrl 이라 Firestore 문서 1MB 한도를 쉽게 넘긴다.
//    무료 백업은 사진을 포함하지 않는다는 안내와도 맞춰, 업로드에서 제외하고
//    내려받을 때는 기기에 있던 사진을 그대로 보존한다.

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { firestore } from '../firebase';
import { db } from '@/lib/db';
import type { KnitLog } from '@/lib/db';
import { sanitizeForFirestore, type FetchResult, type SyncResult } from './common';
import { toLocal, toRemote, type RemoteLog } from './logMap';

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
      if (needsLocalUpdate && local.id) {
        await db.logs.update(local.id, fixUpdates);
      }

      const docRef = doc(firestore, `users/${userId}/logs`, local.cloudId!);
      batch.set(docRef, sanitizeForFirestore(toRemote(local, projectCloudIds)));
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
  const data = toLocal(remote, projectIds, existing?.photos);

  if (existing?.id != null) {
    await db.logs.update(existing.id, data as any);
  } else {
    await db.logs.add(data as KnitLog);
  }
}
