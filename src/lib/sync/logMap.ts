// ----------------------------------------------------------------------------
// 다이어리 기록 ↔ 클라우드 문서 변환 (순수 함수)
// ----------------------------------------------------------------------------
// Firestore / IndexedDB 에 의존하지 않는 변환 로직만 모아 테스트 가능하게 한다.
//
// 핵심은 projectId 다. 기기마다 다른 자동증가 값이라 그대로 주고받으면
// 엉뚱한 프로젝트에 일기가 붙는다. 반드시 cloudId 를 거쳐야 한다.

import type { KnitLog, ProjectPhoto } from '@/lib/db';

/** 클라우드에 저장되는 형태 — 로컬 id / projectId / photos 는 담지 않는다 */
export interface RemoteLog {
  cloudId: string;
  /** 연결된 프로젝트의 cloudId. 자유 기록이면 null */
  projectCloudId: string | null;
  date: string;
  text: string;
  rows?: number;
  mood?: string;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
  deletedAt: number | null;
}

export function toRemote(local: KnitLog, projectCloudIds: Map<number, string>): RemoteLog {
  return {
    cloudId: local.cloudId!,
    projectCloudId:
      local.projectId != null ? (projectCloudIds.get(local.projectId) ?? null) : null,
    date: local.date,
    text: local.text,
    rows: local.rows,
    mood: local.mood,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
    isDeleted: local.isDeleted ?? false,
    deletedAt: local.deletedAt ?? null,
  };
}

/**
 * 원격 기록을 로컬 저장 형태로 되돌린다.
 * @param existingPhotos 이미 기기에 있던 사진 — 클라우드는 사진을 보관하지 않으므로 그대로 살린다
 */
export function toLocal(
  remote: RemoteLog,
  projectIds: Map<string, number>,
  existingPhotos?: ProjectPhoto[],
): Omit<KnitLog, 'id'> {
  const projectId = remote.projectCloudId ? projectIds.get(remote.projectCloudId) : undefined;
  return {
    cloudId: remote.cloudId,
    // 아직 그 프로젝트가 이 기기에 없으면 자유 기록으로 둔다.
    // 프로젝트를 먼저 받아 온 뒤 다시 가져오면 제자리를 찾는다.
    projectId,
    date: remote.date,
    text: remote.text,
    rows: remote.rows,
    mood: remote.mood,
    photos: existingPhotos && existingPhotos.length ? existingPhotos : undefined,
    createdAt: remote.createdAt,
    updatedAt: remote.updatedAt,
    isDeleted: remote.isDeleted ?? false,
    deletedAt: remote.deletedAt ?? null,
  } as Omit<KnitLog, 'id'>;
}

