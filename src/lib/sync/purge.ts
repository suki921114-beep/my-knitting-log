// ----------------------------------------------------------------------------
// 클라우드에서 완전히 지우기
// ----------------------------------------------------------------------------
// 휴지통에서 영구 삭제하거나 보관 기간(7일)이 지나 자동 정리될 때,
// 기기뿐 아니라 클라우드 문서와 사진 파일까지 함께 지운다.
//
// 예전에는 클라우드에 '삭제됨' 표시가 붙은 문서를 묘비로 남겨 두었다.
// 그러다 보니 보관 기간이 끝나도 클라우드에는 기록이 계속 남았다.
// 지금은 실제로 지우고, 대신 fetchRules 의 판정으로 부활을 막는다.
//
// 로그인하지 않았으면 클라우드에 올라간 적이 없거나 지울 권한이 없으므로
// 아무 일도 하지 않는다 (로컬 삭제는 호출한 쪽에서 이미 처리한다).

import { deleteDoc, doc } from 'firebase/firestore';
import { deleteObject, getMetadata, listAll, ref as storageRef } from 'firebase/storage';
import { auth, firestore, storage } from '@/lib/firebase';
import { readUsage, writeUsage } from '@/lib/cloudUsage';

/** 로컬 테이블 이름 → Firestore 컬렉션. null 이면 자체 문서가 없다. */
const COLLECTION_BY_TABLE: Record<string, string | null> = {
  yarns: 'yarns',
  patterns: 'patterns',
  needles: 'needles',
  notions: 'notions',
  projects: 'projects',
  logs: 'logs',
  // 카운터·게이지는 프로젝트 문서 안에 배열로 들어 있어 개별 문서가 없다.
  // 프로젝트를 다음에 올릴 때 배열에서 빠지면서 자연히 사라진다.
  rowCounters: null,
  projectGauges: null,
};

export interface CloudPurgeTarget {
  table: string;
  cloudId?: string;
}

/**
 * 클라우드에서 해당 문서(와 프로젝트라면 사진까지)를 지운다.
 * 실패해도 throw 하지 않는다 — 로컬 삭제까지 함께 막히면 안 되기 때문.
 * @returns 실제로 지운 문서 수
 */
export async function purgeFromCloud(targets: CloudPurgeTarget[]): Promise<number> {
  const uid = auth.currentUser?.uid;
  if (!uid || targets.length === 0) return 0;

  let removed = 0;
  let freedBytes = 0;
  let freedPhotos = 0;

  for (const target of targets) {
    const collection = COLLECTION_BY_TABLE[target.table];
    if (!collection || !target.cloudId) continue;

    try {
      // 프로젝트는 사진이 Storage 에 따로 있어 문서만 지우면 파일이 남는다
      if (target.table === 'projects') {
        const freed = await deletePhotoFolder(uid, target.cloudId);
        freedBytes += freed.bytes;
        freedPhotos += freed.count;
      }

      await deleteDoc(doc(firestore, `users/${uid}/${collection}`, target.cloudId));
      removed++;
    } catch (e) {
      console.warn(`[purge] 클라우드 삭제 실패 (${target.table}/${target.cloudId})`, e);
    }
  }

  if (freedPhotos > 0) {
    try {
      const usage = await readUsage(uid);
      await writeUsage(uid, {
        bytes: Math.max(0, usage.bytes - freedBytes),
        photoCount: Math.max(0, usage.photoCount - freedPhotos),
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('[purge] 사용량 갱신 실패:', e);
    }
  }

  return removed;
}

/** 프로젝트의 사진 폴더를 통째로 비우고, 회수한 용량을 알려 준다 */
async function deletePhotoFolder(uid: string, projectCloudId: string) {
  let bytes = 0;
  let count = 0;

  const folder = storageRef(storage, `users/${uid}/projectPhotos/${projectCloudId}`);
  const listed = await listAll(folder);

  for (const item of listed.items) {
    try {
      // 지우기 전에 크기를 알아야 사용량을 정확히 되돌릴 수 있다
      const meta = await getMetadata(item);
      await deleteObject(item);
      bytes += meta.size ?? 0;
      count += 1;
    } catch (e) {
      console.warn('[purge] 사진 삭제 실패:', item.fullPath, e);
    }
  }

  return { bytes, count };
}
