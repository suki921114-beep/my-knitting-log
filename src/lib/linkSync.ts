// ----------------------------------------------------------------------------
// 프로젝트 ↔ 실/도안/바늘/부자재 연결 테이블 동기화
// ----------------------------------------------------------------------------
// ProjectForm 저장 시, 화면의 링크 목록을 DB 상태와 맞춘다.
// 계획(planLinkSync)과 실행(syncLinks)을 분리해 계획 부분만 테스트할 수 있게 했다.

export interface LinkLike {
  id?: number;
}

export interface LinkSyncPlan<L> {
  /** 화면에서 빠져 DB 에서 지워야 할 기존 링크 id */
  toDelete: number[];
  /** id 가 있어 갱신할 링크 */
  toUpdate: L[];
  /** id 가 없어 새로 만들 링크 */
  toAdd: L[];
}

/**
 * 어떤 링크를 지우고/고치고/추가할지 결정한다. 부수효과 없음.
 */
export function planLinkSync<L extends LinkLike, E extends LinkLike>(
  existing: E[],
  current: L[],
): LinkSyncPlan<L> {
  const keptIds = new Set(
    current.map(l => l.id).filter((id): id is number => id != null),
  );

  const toDelete = existing
    .map(e => e.id)
    .filter((id): id is number => id != null)
    .filter(id => !keptIds.has(id));

  const toUpdate: L[] = [];
  const toAdd: L[] = [];
  for (const l of current) {
    if (l.id != null) toUpdate.push(l);
    else toAdd.push(l);
  }

  return { toDelete, toUpdate, toAdd };
}

/**
 * 계획을 실제 Dexie 테이블에 적용한다.
 * 동기화 메타(cloudId/createdAt/updatedAt/isDeleted)는 기존 값을 보존한다.
 */
export async function syncLinks<L extends LinkLike, E extends LinkLike>(
  table: any,
  existing: E[],
  current: L[],
  buildAdd: (l: L) => any,
  buildUpdate: (l: L) => any,
  t: number,
) {
  const { toDelete, toUpdate, toAdd } = planLinkSync(existing, current);

  if (toDelete.length) {
    await table.bulkDelete(toDelete);
  }

  for (const l of toUpdate) {
    const prev = existing.find(e => e.id === l.id) as any;
    await table.update(l.id, {
      ...buildUpdate(l),
      cloudId: prev?.cloudId || crypto.randomUUID(),
      createdAt: prev?.createdAt ?? t,
      updatedAt: t,
      isDeleted: prev?.isDeleted ?? false,
      deletedAt: prev?.deletedAt ?? null,
    });
  }

  for (const l of toAdd) {
    await table.add({
      ...buildAdd(l),
      cloudId: crypto.randomUUID(),
      createdAt: t,
      updatedAt: t,
      isDeleted: false,
      deletedAt: null,
    });
  }
}
