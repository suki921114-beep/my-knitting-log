import { describe, it, expect } from 'vitest';
import { ensureSyncMeta, planImport } from '@/lib/importMerge';

describe('ensureSyncMeta', () => {
  it('메타가 없는 낡은 백업에 기본값을 채운다', () => {
    const out = ensureSyncMeta([{ name: '실A' } as any], () => 'uuid-1', 1000);
    expect(out[0]).toMatchObject({
      name: '실A',
      cloudId: 'uuid-1',
      isDeleted: false,
      deletedAt: null,
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  it('이미 있는 메타는 덮어쓰지 않는다', () => {
    const out = ensureSyncMeta(
      [{ name: '실B', cloudId: 'keep-me', createdAt: 5, updatedAt: 9, isDeleted: true, deletedAt: 7 } as any],
      () => 'uuid-new',
      1000,
    );
    expect(out[0]).toMatchObject({
      cloudId: 'keep-me',
      createdAt: 5,
      updatedAt: 9,
      isDeleted: true,
      deletedAt: 7,
    });
  });

  it('undefined 를 넣으면 빈 배열', () => {
    expect(ensureSyncMeta(undefined)).toEqual([]);
  });
});

describe('planImport', () => {
  it('cloudId 가 겹치면 로컬 id 를 유지한 채 갱신한다', () => {
    const incoming = [{ id: 99, cloudId: 'c1', name: '수정된 실' }];
    const existing = [{ id: 3, cloudId: 'c1' }];

    const { toUpdate, toAdd } = planImport(incoming as any, existing);

    expect(toAdd).toHaveLength(0);
    expect(toUpdate).toHaveLength(1);
    // 백업 파일의 id(99) 가 아니라 로컬 id(3) 를 써야 한다
    expect(toUpdate[0].id).toBe(3);
    expect((toUpdate[0] as any).name).toBe('수정된 실');
  });

  it('다른 기기 백업의 id 가 로컬 레코드를 덮어쓰지 않는다 (회귀 방지)', () => {
    // 로컬 3번은 '내 실', 백업의 3번은 전혀 다른 '남의 실'
    const incoming = [{ id: 3, cloudId: 'from-other-device', name: '남의 실' }];
    const existing = [{ id: 3, cloudId: 'mine' }];

    const { toUpdate, toAdd } = planImport(incoming as any, existing);

    expect(toUpdate).toHaveLength(0);
    expect(toAdd).toHaveLength(1);
    // id 가 제거되어 새 레코드로 들어가야 한다
    expect('id' in toAdd[0]).toBe(false);
    expect((toAdd[0] as any).name).toBe('남의 실');
  });

  it('로컬에 없는 cloudId 는 새로 추가한다', () => {
    const { toUpdate, toAdd } = planImport(
      [{ cloudId: 'new-1' }, { cloudId: 'new-2' }] as any,
      [],
    );
    expect(toUpdate).toHaveLength(0);
    expect(toAdd).toHaveLength(2);
  });

  it('백업 안에 cloudId 가 중복되면 한 번만 반영한다', () => {
    const { toAdd } = planImport(
      [{ cloudId: 'dup', name: 'first' }, { cloudId: 'dup', name: 'second' }] as any,
      [],
    );
    expect(toAdd).toHaveLength(1);
    expect((toAdd[0] as any).name).toBe('first');
  });

  it('cloudId 가 없는 로컬 레코드는 매칭 대상에서 제외된다', () => {
    const { toAdd, toUpdate } = planImport(
      [{ cloudId: 'c1' }] as any,
      [{ id: 1 }], // cloudId 없음
    );
    expect(toUpdate).toHaveLength(0);
    expect(toAdd).toHaveLength(1);
  });
});
