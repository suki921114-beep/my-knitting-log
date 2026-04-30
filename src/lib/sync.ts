import { db, Yarn, Pattern } from './db';
import { firestore } from './firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

export interface FetchDiff {
  toAdd: Yarn[];
  toUpdate: Yarn[];
  unchanged: number;
}

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

export async function calculateYarnFetchDiff(userId: string): Promise<FetchDiff> {
  const diff: FetchDiff = { toAdd: [], toUpdate: [], unchanged: 0 };
  
  const localYarns = await db.yarns.toArray();
  const localMap = new Map(localYarns.map(y => [y.cloudId!, y]));

  const yarnsRef = collection(firestore, `users/${userId}/yarns`);
  const snapshot = await getDocs(yarnsRef);
  const remoteYarns = snapshot.docs.map(d => d.data() as Yarn);

  for (const remote of remoteYarns) {
    if (!remote.cloudId) continue;
    
    const local = localMap.get(remote.cloudId);
    if (!local) {
      // 로컬에 없으면 새로 추가
      diff.toAdd.push(remote);
    } else {
      // 로컬에 있으면 updatedAt 비교
      if (remote.updatedAt > local.updatedAt) {
        diff.toUpdate.push(remote);
      } else if (remote.updatedAt === local.updatedAt) {
        diff.unchanged++;
      }
      // 로컬이 더 최신인 경우 무시 (업데이트 안함)
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
  delete sanitized.imageDataUrl;
  delete sanitized.fileDataUrl;
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

export async function executeYarnFetch(diff: FetchDiff) {
  let added = 0;
  let updated = 0;
  let failed = 0;

  // 1. 새 항목 추가
  for (const remote of diff.toAdd) {
    try {
      const { id, ...dataToPut } = remote as any;
      await db.yarns.add(dataToPut);
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
        await db.yarns.update(existing.id!, {
          ...remote,
          id: existing.id,
          photoDataUrl: existing.photoDataUrl
        });
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

// ----------------------------------------------------------------------------
// Pattern Sync / Fetch (100% 동일한 구조)
// ----------------------------------------------------------------------------

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

export async function calculatePatternFetchDiff(userId: string): Promise<FetchDiff<Pattern>> {
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
