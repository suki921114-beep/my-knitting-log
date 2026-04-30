import { firestore } from './firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from "@/lib/db";
import type {
  Yarn,
  Pattern,
  Needle,
  Notion,
  Project,
} from "@/lib/db";

export interface FetchDiff<T> {
  toAdd: T[];
  toUpdate: T[];
  unchanged: number;
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  unchanged: number;
  failed: number;
}

export interface FetchResult {
  added: number;
  updated: number;
  unchanged: number;
  failed: number;
}

export interface SyncDiff<T> {
  toUpload: T[];
  toDownload: T[];
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

export function sanitizeForFirestore(value: any): any {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === "number" && Number.isNaN(value)) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === "object") {
    const result: Record<string, any> = {};

    for (const [key, val] of Object.entries(value)) {
      const sanitized = sanitizeForFirestore(val);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }

    return result;
  }

  return value;
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

// ----------------------------------------------------------------------------
// Needle Sync / Fetch (100% 동일한 구조)
// ----------------------------------------------------------------------------

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

type ProjectSyncPayload = {
  cloudId: string;
  name: string;
  status: Project["status"];
  startDate?: string;
  endDate?: string;
  size?: string;
  gauge?: string;
  progressNote?: string;
  finishedNote?: string;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
  deletedAt: number | null;

  yarnLinks: Array<{
    cloudId: string;
    yarnCloudId: string;
    usedGrams: number;
    plannedGrams?: number;
    colorNote?: string;
    usageNote?: string;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
    deletedAt: number | null;
  }>;

  patternLinks: Array<{
    cloudId: string;
    patternCloudId: string;
    note?: string;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
    deletedAt: number | null;
  }>;

  needleLinks: Array<{
    cloudId: string;
    needleCloudId: string;
    note?: string;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
    deletedAt: number | null;
  }>;

  rowCounters: Array<{
    cloudId: string;
    name: string;
    count: number;
    goal?: number;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
    deletedAt: number | null;
  }>;
};

function cleanProjectText(value?: string) {
  return value && value.trim() ? value : undefined;
}

export type ProjectSyncDiff = {
  toUpload: number[]; // local project id 목록
  toDownload: ProjectSyncPayload[]; // remote project 문서 목록
  unchanged: number;
};

export type ProjectFetchDiff = {
  toAdd: ProjectSyncPayload[];
  toUpdate: ProjectSyncPayload[];
  unchanged: number;
};

export async function buildProjectSyncPayload(projectId: number): Promise<ProjectSyncPayload> {
  const project = await db.projects.get(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  if (!project.cloudId) {
    throw new Error(`Project ${projectId} has no cloudId`);
  }

  const [
    projectYarns,
    projectPatterns,
    projectNeedles,
    projectNotions,
    rowCounters,
  ] = await Promise.all([
    db.projectYarns.where("projectId").equals(projectId).toArray(),
    db.projectPatterns.where("projectId").equals(projectId).toArray(),
    db.projectNeedles.where("projectId").equals(projectId).toArray(),
    db.projectNotions.where("projectId").equals(projectId).toArray(),
    db.rowCounters.where("projectId").equals(projectId).toArray(),
  ]);

  const yarnLinks: ProjectSyncPayload["yarnLinks"] = [];
  for (const link of projectYarns) {
    const yarn = await db.yarns.get(link.yarnId);
    if (!yarn?.cloudId) continue;

    yarnLinks.push({
      cloudId: link.cloudId!,
      yarnCloudId: yarn.cloudId,
      usedGrams: link.usedGrams,
      plannedGrams: link.plannedGrams,
      colorNote: cleanProjectText(link.colorNote),
      usageNote: cleanProjectText(link.usageNote),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    });
  }

  const patternLinks: ProjectSyncPayload["patternLinks"] = [];
  for (const link of projectPatterns) {
    const pattern = await db.patterns.get(link.patternId);
    if (!pattern?.cloudId) continue;

    patternLinks.push({
      cloudId: link.cloudId!,
      patternCloudId: pattern.cloudId,
      note: cleanProjectText(link.note),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    });
  }

  const needleLinks: ProjectSyncPayload["needleLinks"] = [];
  for (const link of projectNeedles) {
    const needle = await db.needles.get(link.needleId);
    if (!needle?.cloudId) continue;

    needleLinks.push({
      cloudId: link.cloudId!,
      needleCloudId: needle.cloudId,
      note: cleanProjectText(link.note),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    });
  }

  const notionLinks: ProjectSyncPayload["notionLinks"] = [];
  for (const link of projectNotions) {
    const notion = await db.notions.get(link.notionId);
    if (!notion?.cloudId) continue;

    notionLinks.push({
      cloudId: link.cloudId!,
      notionCloudId: notion.cloudId,
      quantity: link.quantity,
      note: cleanProjectText(link.note),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    });
  }

  const rowCounterPayloads: ProjectSyncPayload["rowCounters"] = [];

  for (const counter of rowCounters) {
    const fixUpdates: any = {};
    let needsLocalUpdate = false;

    if (!counter.cloudId) {
      fixUpdates.cloudId = crypto.randomUUID();
      counter.cloudId = fixUpdates.cloudId;
      needsLocalUpdate = true;
    }

    if (!counter.createdAt) {
      fixUpdates.createdAt = Date.now();
      counter.createdAt = fixUpdates.createdAt;
      needsLocalUpdate = true;
    }

    if (!counter.updatedAt || Number.isNaN(counter.updatedAt)) {
      fixUpdates.updatedAt = Date.now();
      counter.updatedAt = fixUpdates.updatedAt;
      needsLocalUpdate = true;
    }

    if (counter.isDeleted === undefined) {
      fixUpdates.isDeleted = false;
      counter.isDeleted = false;
      needsLocalUpdate = true;
    }

    if (counter.deletedAt === undefined) {
      fixUpdates.deletedAt = null;
      counter.deletedAt = null;
      needsLocalUpdate = true;
    }

    if (needsLocalUpdate && counter.id) {
      await db.rowCounters.update(counter.id, fixUpdates);
    }

    rowCounterPayloads.push({
      cloudId: counter.cloudId!,
      name: counter.name,
      count: counter.count ?? 0,
      goal: counter.goal,
      createdAt: counter.createdAt,
      updatedAt: counter.updatedAt,
      isDeleted: counter.isDeleted ?? false,
      deletedAt: counter.deletedAt ?? null,
    });
  }

  const projectPayloadUpdatedAt = Math.max(
    project.updatedAt ?? 0,
    ...projectYarns.map(x => x.updatedAt ?? 0),
    ...projectPatterns.map(x => x.updatedAt ?? 0),
    ...projectNeedles.map(x => x.updatedAt ?? 0),
    ...projectNotions.map(x => x.updatedAt ?? 0),
    ...rowCounterPayloads.map(x => x.updatedAt ?? 0),
  );
  
  return {
    cloudId: project.cloudId,
    name: project.name,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    size: cleanProjectText(project.size),
    gauge: cleanProjectText(project.gauge),
    progressNote: cleanProjectText(project.progressNote),
    finishedNote: cleanProjectText(project.finishedNote),
    createdAt: project.createdAt,
    updatedAt: projectPayloadUpdatedAt,
    isDeleted: project.isDeleted ?? false,
    deletedAt: project.deletedAt ?? null,

    yarnLinks,
    patternLinks,
    needleLinks,
    notionLinks,
    rowCounters: rowCounterPayloads,
  };
}

async function getProjectLocalSyncUpdatedAt(projectId: number, fallback = 0) {
  const [
    projectYarns,
    projectPatterns,
    projectNeedles,
    projectNotions,
    rowCounters,
  ] = await Promise.all([
    db.projectYarns.where("projectId").equals(projectId).toArray(),
    db.projectPatterns.where("projectId").equals(projectId).toArray(),
    db.projectNeedles.where("projectId").equals(projectId).toArray(),
    db.projectNotions.where("projectId").equals(projectId).toArray(),
    db.rowCounters.where("projectId").equals(projectId).toArray(),
  ]);

  return Math.max(
    fallback,
    ...projectYarns.map(x => x.updatedAt ?? 0),
    ...projectPatterns.map(x => x.updatedAt ?? 0),
    ...projectNeedles.map(x => x.updatedAt ?? 0),
    ...projectNotions.map(x => x.updatedAt ?? 0),
    ...rowCounters.map(x => x.updatedAt ?? 0),
  );
}

async function upsertProjectFromCloud(remote: ProjectSyncPayload) {
  const existing = await db.projects.where("cloudId").equals(remote.cloudId).first();

  const baseProjectData = {
    name: remote.name,
    status: remote.status,
    startDate: remote.startDate,
    endDate: remote.endDate,
    size: remote.size,
    gauge: remote.gauge,
    progressNote: remote.progressNote,
    finishedNote: remote.finishedNote,
    cloudId: remote.cloudId,
    createdAt: remote.createdAt,
    updatedAt: remote.updatedAt,
    isDeleted: remote.isDeleted ?? false,
    deletedAt: remote.deletedAt ?? null,
  };

  let projectId: number;

  if (existing) {
    await db.projects.update(existing.id!, {
      ...baseProjectData,
      id: existing.id,
      // 1차에서는 photos는 클라우드에 안 올리므로 로컬 값 유지
      photos: existing.photos,
    } as any);
    projectId = existing.id!;
  } else {
    projectId = await db.projects.add({
      ...baseProjectData,
      photos: undefined,
    } as any);
  }

  // 기존 연결 전부 삭제 후 클라우드 기준으로 재구성
    const [oldYarns, oldPatterns, oldNeedles, oldNotions, oldRowCounters] = await Promise.all([
    db.projectYarns.where("projectId").equals(projectId).toArray(),
    db.projectPatterns.where("projectId").equals(projectId).toArray(),
    db.projectNeedles.where("projectId").equals(projectId).toArray(),
    db.projectNotions.where("projectId").equals(projectId).toArray(),
    db.rowCounters.where("projectId").equals(projectId).toArray(),
  ]);
 
  if (oldYarns.length) {
    await db.projectYarns.bulkDelete(oldYarns.map(x => x.id!).filter(Boolean));
  }
  if (oldPatterns.length) {
    await db.projectPatterns.bulkDelete(oldPatterns.map(x => x.id!).filter(Boolean));
  }
  if (oldNeedles.length) {
    await db.projectNeedles.bulkDelete(oldNeedles.map(x => x.id!).filter(Boolean));
  }
  if (oldNotions.length) {
    await db.projectNotions.bulkDelete(oldNotions.map(x => x.id!).filter(Boolean));
  }
  if (oldRowCounters.length) {
    await db.rowCounters.bulkDelete(oldRowCounters.map(x => x.id!).filter(Boolean));
  }
  // yarn links 복원
  for (const link of remote.yarnLinks || []) {
    const yarn = await db.yarns.where("cloudId").equals(link.yarnCloudId).first();
    if (!yarn?.id) continue;

    await db.projectYarns.add({
      projectId,
      yarnId: yarn.id,
      usedGrams: link.usedGrams,
      plannedGrams: link.plannedGrams,
      colorNote: link.colorNote,
      usageNote: link.usageNote,
      cloudId: link.cloudId,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    } as any);
  }

  // pattern links 복원
  for (const link of remote.patternLinks || []) {
    const pattern = await db.patterns.where("cloudId").equals(link.patternCloudId).first();
    if (!pattern?.id) continue;

    await db.projectPatterns.add({
      projectId,
      patternId: pattern.id,
      note: link.note,
      cloudId: link.cloudId,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    } as any);
  }

  // needle links 복원
  for (const link of remote.needleLinks || []) {
    const needle = await db.needles.where("cloudId").equals(link.needleCloudId).first();
    if (!needle?.id) continue;

    await db.projectNeedles.add({
      projectId,
      needleId: needle.id,
      note: link.note,
      cloudId: link.cloudId,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    } as any);
  }

  // notion links 복원
  for (const link of remote.notionLinks || []) {
    const notion = await db.notions.where("cloudId").equals(link.notionCloudId).first();
    if (!notion?.id) continue;

    await db.projectNotions.add({
      projectId,
      notionId: notion.id,
      quantity: link.quantity,
      note: link.note,
      cloudId: link.cloudId,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    } as any);
  }
    // row counters 복원
  for (const counter of remote.rowCounters || []) {
    await db.rowCounters.add({
      projectId,
      name: counter.name,
      count: counter.count ?? 0,
      goal: counter.goal,
      cloudId: counter.cloudId || crypto.randomUUID(),
      createdAt: counter.createdAt ?? Date.now(),
      updatedAt: counter.updatedAt ?? Date.now(),
      isDeleted: counter.isDeleted ?? false,
      deletedAt: counter.deletedAt ?? null,
    } as any);
  }
}


export async function calculateProjectSyncDiff(userId: string): Promise<ProjectSyncDiff> {
  const diff: ProjectSyncDiff = { toUpload: [], toDownload: [], unchanged: 0 };

  const localProjects = await db.projects.toArray();
  const localMap = new Map(
    localProjects.filter(p => p.cloudId).map(p => [p.cloudId!, p])
  );

  const projectsRef = collection(firestore, `users/${userId}/projects`);
  const snapshot = await getDocs(projectsRef);
  const remoteProjects = snapshot.docs.map(d => d.data() as ProjectSyncPayload);
  const remoteMap = new Map(
    remoteProjects.filter(p => p.cloudId).map(p => [p.cloudId, p])
  );

  for (const local of localProjects) {
    if (!local.id) continue;

    if (!local.cloudId) {
      diff.toUpload.push(local.id);
      continue;
    }

    const remote = remoteMap.get(local.cloudId);

    if (!remote) {
      diff.toUpload.push(local.id);
    } else {
      const localSyncUpdatedAt = await getProjectLocalSyncUpdatedAt(
        local.id,
        local.updatedAt ?? 0
      );

      if (localSyncUpdatedAt > (remote.updatedAt ?? 0)) {
        diff.toUpload.push(local.id);
      } else if (localSyncUpdatedAt < (remote.updatedAt ?? 0)) {
        diff.toDownload.push(remote);
      } else {
        diff.unchanged++;
      }
    }
  }

  for (const remote of remoteProjects) {
    if (!remote.cloudId) continue;
    if (!localMap.has(remote.cloudId)) {
      diff.toDownload.push(remote);
    }
  }

  return diff;
}

export async function calculateProjectFetchDiff(userId: string): Promise<ProjectFetchDiff> {
  const diff: ProjectFetchDiff = { toAdd: [], toUpdate: [], unchanged: 0 };

  const localProjects = await db.projects.toArray();
  const localMap = new Map(
    localProjects.filter(p => p.cloudId).map(p => [p.cloudId!, p])
  );

  const projectsRef = collection(firestore, `users/${userId}/projects`);
  const snapshot = await getDocs(projectsRef);
  const remoteProjects = snapshot.docs.map(d => d.data() as ProjectSyncPayload);

  for (const remote of remoteProjects) {
    if (!remote.cloudId) continue;

    const local = localMap.get(remote.cloudId);

    if (!local) {
      diff.toAdd.push(remote);
        } else {
      const localSyncUpdatedAt = await getProjectLocalSyncUpdatedAt(
        local.id!,
        local.updatedAt ?? 0
      );

      if ((remote.updatedAt ?? 0) > localSyncUpdatedAt) {
        diff.toUpdate.push(remote);
      } else {
        diff.unchanged++;
      }
    }
  }

  return diff;
}

export async function executeProjectSync(
  userId: string,
  diff: ProjectSyncDiff
): Promise<SyncResult> {
  let uploaded = 0;
  let downloaded = 0;
  let failed = 0;

  try {
    const batch = writeBatch(firestore);

    for (const localProjectId of diff.toUpload) {
      try {
        const localProject = await db.projects.get(localProjectId);
        if (!localProject) {
          failed++;
          continue;
        }

        const fixUpdates: any = {};
        let needsLocalUpdate = false;

        if (!localProject.cloudId) {
          fixUpdates.cloudId = crypto.randomUUID();
          needsLocalUpdate = true;
        }

        if (!localProject.createdAt) {
          fixUpdates.createdAt = Date.now();
          needsLocalUpdate = true;
        }

        if (!localProject.updatedAt || Number.isNaN(localProject.updatedAt)) {
          fixUpdates.updatedAt = Date.now();
          needsLocalUpdate = true;
        }

        if (localProject.isDeleted === undefined) {
          fixUpdates.isDeleted = false;
          needsLocalUpdate = true;
        }

        if (localProject.deletedAt === undefined) {
          fixUpdates.deletedAt = null;
          needsLocalUpdate = true;
        }

        if (needsLocalUpdate) {
          await db.projects.update(localProjectId, fixUpdates);
        }

        const payload = await buildProjectSyncPayload(localProjectId);
        const docRef = doc(firestore, `users/${userId}/projects`, payload.cloudId);
        
        const safePayload = sanitizeForFirestore(payload);

        console.log(`[Project Sync Upload] ${payload.name}`);
        console.log(`  - cloudId: ${payload.cloudId}`);
        console.log(`  - updatedAt: ${payload.updatedAt}`);
        console.log(`  - payload:`, payload);

        batch.set(docRef, safePayload);
        uploaded++;
      } catch (e) {
        console.error(`[Sync] Project 업로드 준비 실패: ${localProjectId}`, e);
        failed++;
      }
    }

    try {
      await batch.commit();
    } catch (batchError) {
      console.error("[Sync] Firestore Batch Commit 실패 (Project):", batchError);
      failed += uploaded;
      uploaded = 0;
    }

    for (const remote of diff.toDownload) {
      try {
        await upsertProjectFromCloud(remote);
        downloaded++;
      } catch (e) {
        console.error(`[Sync] Project 다운로드/저장 실패: ${remote.name} (${remote.cloudId})`, e);
        failed++;
      }
    }

    return {
      uploaded,
      downloaded,
      unchanged: diff.unchanged,
      failed,
    };
  } catch (error) {
    console.error("Project Sync execution error:", error);
    throw error;
  }
}

export async function executeProjectFetch(
  diff: ProjectFetchDiff
): Promise<FetchResult> {
  let added = 0;
  let updated = 0;
  let failed = 0;

  for (const remote of diff.toAdd) {
    try {
      await upsertProjectFromCloud(remote);
      added++;
    } catch (e) {
      console.error(`[Fetch] Project 추가 실패: ${remote.name} (${remote.cloudId})`, e);
      failed++;
    }
  }

  for (const remote of diff.toUpdate) {
    try {
      await upsertProjectFromCloud(remote);
      updated++;
    } catch (e) {
      console.error(`[Fetch] Project 덮어쓰기 실패: ${remote.name} (${remote.cloudId})`, e);
      failed++;
    }
  }

  return {
    added,
    updated,
    unchanged: diff.unchanged,
    failed,
  };
}
