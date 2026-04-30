import { db, Yarn } from './db';
import { firestore } from './firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

export interface SyncDiff {
  toUpload: Yarn[];
  toDownload: Yarn[];
  unchanged: number;
}

export async function calculateYarnSyncDiff(userId: string): Promise<SyncDiff> {
  const diff: SyncDiff = { toUpload: [], toDownload: [], unchanged: 0 };
  
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

export function sanitizeForFirestore(obj: any): any {
  const sanitized = { ...obj };
  for (const key in sanitized) {
    if (sanitized[key] === undefined) {
      delete sanitized[key];
    } else if (typeof sanitized[key] === 'number' && Number.isNaN(sanitized[key])) {
      sanitized[key] = null; // Firestore doesn't support NaN
    }
  }
  // Remove fields that shouldn't be synced to Firestore
  delete sanitized.photoDataUrl;
  delete sanitized.id;
  return sanitized;
}

export async function executeYarnSync(userId: string, diff: SyncDiff) {
  let uploaded = 0;
  let downloaded = 0;
  let failed = 0;

  try {
    // 1. Firestore로 업로드 (이미지 필드 제외)
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

        const docRef = doc(firestore, `users/${userId}/yarns`, local.cloudId!);
        const uploadData = sanitizeForFirestore(local);
        
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

    // 2. 로컬(Dexie)로 다운로드 (기존 이미지/id 보존)
    for (const remote of diff.toDownload) {
      try {
        const existing = await db.yarns.where('cloudId').equals(remote.cloudId!).first();
        if (existing) {
          // 기존 항목 업데이트 (photoDataUrl과 로컬 id 유지)
          await db.yarns.update(existing.id!, {
            ...remote,
            id: existing.id,
            photoDataUrl: existing.photoDataUrl
          });
        } else {
          // 새로 생성
          const { id, ...dataToPut } = remote as any; 
          await db.yarns.add(dataToPut);
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
