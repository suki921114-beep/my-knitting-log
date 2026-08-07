import { describe, it, expect } from 'vitest';
import { toRemotePhoto } from '@/lib/sync/photoSync';
import { toRemote, toLocal, type RemoteLog } from '@/lib/sync/logMap';
import type { KnitLog, ProjectPhoto } from '@/lib/db';

// ----------------------------------------------------------------------------
// 사진이 문서에 실려 가는 모양
// ----------------------------------------------------------------------------
// 그림(dataUrl)이 문서에 섞여 올라가면 안 된다. 문서 하나는 1MB 한도가 있어서
// 사진이 조금만 커도 저장이 통째로 실패한다. 문서에는 '어디에 있는지'만 담는다.

const photo = (over: Partial<ProjectPhoto> = {}): ProjectPhoto => ({
  cloudId: 'p1',
  dataUrl: 'data:image/jpeg;base64,AAAA',
  storagePath: 'users/u1/projectPhotos/log1/p1.jpg',
  contentType: 'image/jpeg',
  createdAt: 1,
  updatedAt: 2,
  isDeleted: false,
  deletedAt: null,
  ...over,
});

describe('toRemotePhoto', () => {
  it('그림은 빼고 위치만 담는다', () => {
    const remote = toRemotePhoto(photo());
    expect(remote).not.toBeNull();
    expect(remote).not.toHaveProperty('dataUrl');
    expect(remote!.storagePath).toBe('users/u1/projectPhotos/log1/p1.jpg');
  });

  it('아직 안 올라간 사진은 문서에 담지 않는다', () => {
    // 위치가 없으면 다른 기기에서 찾을 방법이 없다. 담아 봐야 쓸모가 없다.
    expect(toRemotePhoto(photo({ storagePath: undefined }))).toBeNull();
  });
});

describe('다이어리 기록 ↔ 문서', () => {
  const local: KnitLog = {
    id: 7,
    cloudId: 'log1',
    projectId: 3,
    date: '2026-08-06',
    text: '소매 시작',
    mood: '😊',
    photos: [photo()],
    createdAt: 1,
    updatedAt: 2,
  };

  it('올릴 때 그림이 문서에 섞이지 않는다', () => {
    const remote = toRemote(local, new Map([[3, 'proj-cloud']]), [toRemotePhoto(photo())!]);
    expect(JSON.stringify(remote)).not.toContain('data:image');
    expect(remote.photos).toHaveLength(1);
    expect(remote.projectCloudId).toBe('proj-cloud');
  });

  it('사진이 없으면 photos 를 아예 안 담는다', () => {
    const remote = toRemote({ ...local, photos: [] }, new Map([[3, 'proj-cloud']]), []);
    expect(remote.photos).toBeUndefined();
  });

  it('받아온 사진으로 기기 기록을 채운다', () => {
    const remote: RemoteLog = {
      cloudId: 'log1',
      projectCloudId: 'proj-cloud',
      date: '2026-08-06',
      text: '소매 시작',
      photos: [toRemotePhoto(photo())!],
      createdAt: 1,
      updatedAt: 2,
      isDeleted: false,
      deletedAt: null,
    };
    const back = toLocal(remote, new Map([['proj-cloud', 3]]), [photo()]);
    expect(back.photos).toHaveLength(1);
    expect(back.photos![0].dataUrl).toBe('data:image/jpeg;base64,AAAA');
    expect(back.projectId).toBe(3);
  });

  it('사진을 안 넘기면 기기에 있던 것을 건드리지 않는다', () => {
    const remote: RemoteLog = {
      cloudId: 'log1',
      projectCloudId: null,
      date: '2026-08-06',
      text: '소매 시작',
      createdAt: 1,
      updatedAt: 2,
      isDeleted: false,
      deletedAt: null,
    };
    const back = toLocal(remote, new Map());
    expect(back.photos).toBeUndefined();
  });

  it('예전 기록에는 photos 칸이 없다 — 그래도 읽혀야 한다', () => {
    // 이 기능이 생기기 전에 올라간 문서들이다. 읽다가 터지면 안 된다.
    const old = {
      cloudId: 'log0',
      projectCloudId: null,
      date: '2026-07-01',
      text: '옛 기록',
      createdAt: 1,
      updatedAt: 1,
      isDeleted: false,
      deletedAt: null,
    } as RemoteLog;
    expect(() => toLocal(old, new Map())).not.toThrow();
  });
});
