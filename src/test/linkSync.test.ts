import { describe, it, expect, vi } from 'vitest';
import { planLinkSync, syncLinks } from '@/lib/linkSync';

describe('planLinkSync', () => {
  it('화면에서 빠진 링크는 삭제 대상', () => {
    const plan = planLinkSync([{ id: 1 }, { id: 2 }], [{ id: 1 }]);
    expect(plan.toDelete).toEqual([2]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toAdd).toHaveLength(0);
  });

  it('id 없는 링크는 새로 추가', () => {
    const plan = planLinkSync([], [{ refId: 5 } as any]);
    expect(plan.toAdd).toHaveLength(1);
    expect(plan.toDelete).toHaveLength(0);
  });

  it('전부 지우면 기존 링크 전부 삭제 대상', () => {
    const plan = planLinkSync([{ id: 1 }, { id: 2 }, { id: 3 }], []);
    expect(plan.toDelete).toEqual([1, 2, 3]);
  });

  it('변경 없으면 삭제/추가가 없다', () => {
    const plan = planLinkSync([{ id: 1 }, { id: 2 }], [{ id: 1 }, { id: 2 }]);
    expect(plan.toDelete).toHaveLength(0);
    expect(plan.toAdd).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(2);
  });

  it('추가와 삭제가 동시에 일어나도 서로 간섭하지 않는다', () => {
    const plan = planLinkSync(
      [{ id: 1 }, { id: 2 }],
      [{ id: 2 }, { refId: 9 } as any],
    );
    expect(plan.toDelete).toEqual([1]);
    expect(plan.toUpdate.map(l => l.id)).toEqual([2]);
    expect(plan.toAdd).toHaveLength(1);
  });
});

describe('syncLinks', () => {
  function fakeTable() {
    return {
      bulkDelete: vi.fn(async () => {}),
      update: vi.fn(async () => {}),
      add: vi.fn(async () => 1),
    };
  }

  it('갱신 시 기존 cloudId 와 createdAt 을 보존한다', async () => {
    const table = fakeTable();
    const existing = [{ id: 1, cloudId: 'keep', createdAt: 111, isDeleted: false, deletedAt: null }];

    await syncLinks(table, existing, [{ id: 1 }], () => ({}), () => ({ note: 'x' }), 999);

    expect(table.update).toHaveBeenCalledTimes(1);
    const patch = table.update.mock.calls[0][1];
    expect(patch.cloudId).toBe('keep');
    expect(patch.createdAt).toBe(111);
    expect(patch.updatedAt).toBe(999);
  });

  it('삭제된 링크만 bulkDelete 로 넘어간다', async () => {
    const table = fakeTable();
    await syncLinks(table, [{ id: 1 }, { id: 2 }], [{ id: 1 }], () => ({}), () => ({}), 1);
    expect(table.bulkDelete).toHaveBeenCalledWith([2]);
  });

  it('삭제할 게 없으면 bulkDelete 를 호출하지 않는다', async () => {
    const table = fakeTable();
    await syncLinks(table, [{ id: 1 }], [{ id: 1 }], () => ({}), () => ({}), 1);
    expect(table.bulkDelete).not.toHaveBeenCalled();
  });

  it('새 링크에는 동기화 메타가 채워진다', async () => {
    const table = fakeTable();
    await syncLinks(table, [], [{ refId: 7 } as any], l => ({ refId: (l as any).refId }), () => ({}), 555);

    const added = table.add.mock.calls[0][0];
    expect(added.refId).toBe(7);
    expect(added.isDeleted).toBe(false);
    expect(added.deletedAt).toBeNull();
    expect(added.createdAt).toBe(555);
    expect(typeof added.cloudId).toBe('string');
  });
});
