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

export async function executeYarnSync(userId: string, diff: SyncDiff) {
  let uploaded = 0;
  let downloaded = 0;
  let failed = 0;

  try {
    // 1. Firestore로 업로드 (이미지 필드 제외)
    const batch = writeBatch(firestore);
    for (const local of diff.toUpload) {
      try {
        const docRef = doc(firestore, `users/${userId}/yarns`, local.cloudId!);
        const uploadData = { ...local };
        delete uploadData.photoDataUrl; // 중요: 1차에서 이미지는 동기화 제외
        delete uploadData.id;           // 클라우드에는 로컬 id 저장 안함
        batch.set(docRef, uploadData);
        uploaded++;
      } catch (e) {
        failed++;
      }
    }
    await batch.commit();

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
