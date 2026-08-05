import { describe, it, expect } from 'vitest';
import { toRemote, toLocal, type RemoteLog } from '@/lib/sync/logMap';
import type { KnitLog, ProjectPhoto } from '@/lib/db';

// ----------------------------------------------------------------------------
// 다이어리 클라우드 동기화 — 프로젝트 연결이 기기 간에 어긋나지 않는지
// ----------------------------------------------------------------------------
// projectId 는 기기마다 다른 자동증가 값이라 그대로 주고받으면 엉뚱한 프로젝트에
// 일기가 붙는다. 반드시 cloudId 를 거쳐야 한다.

function makeLog(over: Partial<KnitLog> = {}): KnitLog {
  return {
    id: 1,
    cloudId: 'log-1',
    projectId: 3,
    date: '2026-08-05',
    text: '소매 절반',
    createdAt: 1000,
    updatedAt: 2000,
    isDeleted: false,
    deletedAt: null,
    ...over,
  } as KnitLog;
}

describe('일기 동기화 — 프로젝트 연결', () => {
  it('올릴 때 projectId 를 projectCloudId 로 바꾼다', () => {
    const remote = toRemote(makeLog(), new Map([[3, 'proj-abc']]));
    expect(remote.projectCloudId).toBe('proj-abc');
    expect(remote).not.toHaveProperty('projectId');
    expect(remote).not.toHaveProperty('id');
  });

  it('받을 때 이 기기의 projectId 로 되돌린다 (id 가 달라도)', () => {
    const remote: RemoteLog = {
      cloudId: 'log-1',
      projectCloudId: 'proj-abc',
      date: '2026-08-05',
      text: '소매 절반',
      createdAt: 1000,
      updatedAt: 2000,
      isDeleted: false,
      deletedAt: null,
    };
    // 같은 프로젝트가 이 기기에서는 7번
    const local = toLocal(remote, new Map([['proj-abc', 7]]));
    expect(local.projectId).toBe(7);
  });

  it('그 프로젝트가 아직 이 기기에 없으면 자유 기록으로 둔다', () => {
    const remote = toRemote(makeLog(), new Map([[3, 'proj-abc']]));
    const local = toLocal(remote, new Map());
    // 없는 프로젝트에 억지로 붙이지 않는다
    expect(local.projectId).toBeUndefined();
    expect(local.text).toBe('소매 절반');
  });

  it('연결된 프로젝트가 없는 일기는 null 로 올라간다', () => {
    const remote = toRemote(makeLog({ projectId: undefined }), new Map());
    expect(remote.projectCloudId).toBeNull();
  });

  it('로컬 projectId 가 클라우드 값으로 덮어써지지 않는다', () => {
    // 기기 A: 3번 → proj-abc / 기기 B: 같은 프로젝트가 9번
    const remote = toRemote(makeLog({ projectId: 3 }), new Map([[3, 'proj-abc']]));
    const onDeviceB = toLocal(remote, new Map([['proj-abc', 9]]));
    expect(onDeviceB.projectId).toBe(9);
    expect(onDeviceB.projectId).not.toBe(3);
  });
});

describe('일기 동기화 — 사진', () => {
  const photo: ProjectPhoto = {
    cloudId: 'photo-1',
    dataUrl: 'data:image/webp;base64,AAAA',
    createdAt: 1,
    updatedAt: 1,
    isDeleted: false,
    deletedAt: null,
  };

  it('사진은 클라우드로 올리지 않는다 (문서 크기 한도)', () => {
    const remote = toRemote(makeLog({ photos: [photo] }), new Map([[3, 'proj-abc']]));
    expect(remote).not.toHaveProperty('photos');
  });

  it('받아올 때 기기에 있던 사진을 지우지 않는다', () => {
    const remote = toRemote(makeLog(), new Map([[3, 'proj-abc']]));
    const local = toLocal(remote, new Map([['proj-abc', 3]]), [photo]);
    expect(local.photos).toEqual([photo]);
  });
});

describe('일기 동기화 — 삭제 전파', () => {
  it('휴지통에 있는 기록도 삭제 상태로 올라간다', () => {
    const remote = toRemote(
      makeLog({ isDeleted: true, deletedAt: 5000 }),
      new Map([[3, 'proj-abc']]),
    );
    expect(remote.isDeleted).toBe(true);
    expect(remote.deletedAt).toBe(5000);
  });
});
