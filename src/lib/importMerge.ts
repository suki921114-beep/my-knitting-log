// ----------------------------------------------------------------------------
// JSON 백업 가져오기 — 병합 계획 (순수 함수)
// ----------------------------------------------------------------------------
// 기존 구현은 백업 항목을 그대로 bulkPut 했다. Dexie 의 기본 키는 자동증가
// `id` 이므로, 다른 기기에서 만든 백업을 가져오면 **id 가 우연히 겹치는 로컬
// 레코드를 덮어써 버린다**. (예: 기기 A 의 3번 실 ↔ 기기 B 의 3번 도안이 아니라
// 같은 테이블 3번 실끼리 충돌 — 전혀 다른 실인데 덮어써짐)
//
// 그래서 동일성 판단은 항상 `cloudId` 로 한다.
//   - cloudId 가 로컬에 있으면 → 그 로컬 id 를 유지한 채 갱신
//   - 없으면 → id 를 떼고 새 레코드로 추가
//
// 이 파일은 IndexedDB 에 의존하지 않는 순수 함수만 담아 테스트 가능하게 한다.

export interface SyncMetaLike {
  id?: number;
  cloudId?: string;
  isDeleted?: boolean;
  deletedAt?: number | null;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * 낡은 백업(동기화 메타가 없는 v4 이하)에 기본값을 채운다.
 * @param newId cloudId 생성기 — 테스트에서 주입 가능
 * @param nowMs 기준 시각 — 테스트에서 주입 가능
 */
export function ensureSyncMeta<T extends SyncMetaLike>(
  items: T[] | undefined,
  newId: () => string = () => crypto.randomUUID(),
  nowMs: number = Date.now(),
): T[] {
  if (!items) return [];
  return items.map(item => ({
    ...item,
    cloudId: item.cloudId || newId(),
    isDeleted: item.isDeleted || false,
    deletedAt: item.deletedAt ?? null,
    createdAt: item.createdAt || nowMs,
    updatedAt: item.updatedAt || nowMs,
  }));
}

export interface ImportPlan<T> {
  /** 로컬에 같은 cloudId 가 있어 id 를 유지한 채 덮어쓸 항목 */
  toUpdate: T[];
  /** 로컬에 없어 새로 추가할 항목 (id 제거됨) */
  toAdd: T[];
}

/**
 * 백업 항목들을 로컬 레코드와 cloudId 기준으로 병합할 계획을 세운다.
 * 로컬 id 는 절대 백업 파일의 id 로 덮어쓰지 않는다.
 */
export function planImport<T extends SyncMetaLike>(
  incoming: T[],
  existing: Pick<SyncMetaLike, 'id' | 'cloudId'>[],
): ImportPlan<T> {
  const localIdByCloudId = new Map<string, number>();
  for (const e of existing) {
    if (e.cloudId && e.id != null) localIdByCloudId.set(e.cloudId, e.id);
  }

  const toUpdate: T[] = [];
  const toAdd: T[] = [];
  // 같은 백업 안에 cloudId 가 중복될 경우 마지막 것만 반영 (방어)
  const seen = new Set<string>();

  for (const item of incoming) {
    const cid = item.cloudId!;
    if (seen.has(cid)) continue;
    seen.add(cid);

    const localId = localIdByCloudId.get(cid);
    if (localId != null) {
      toUpdate.push({ ...item, id: localId });
    } else {
      const { id: _drop, ...rest } = item as any;
      toAdd.push(rest as T);
    }
  }

  return { toUpdate, toAdd };
}
