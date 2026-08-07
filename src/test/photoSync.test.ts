import { describe, it, expect } from 'vitest';
import { toRemotePhoto, hasUnuploadedPhotos } from '@/lib/sync/photoSync';
import { needsCoverMigration, YARN_COVER } from '@/lib/sync/coverSync';
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

describe('한 번 더 올려서 옮겨야 하는 경우', () => {
  it('문서에 그림이 박혀 있고 위치가 없으면 옮긴다', () => {
    // 백업은 '기기가 더 새로울 때' 만 올린다. 이 확인이 없으면 예전에
    // 백업해 둔 사진은 영영 문서 안에 남는다.
    const local = { photoDataUrl: 'data:image/webp;base64,AAAA' };
    const remote = { photoDataUrl: 'data:image/webp;base64,AAAA' };
    expect(needsCoverMigration(local, remote, YARN_COVER)).toBe(true);
  });

  it('이미 옮겼으면 그냥 둔다', () => {
    const local = { photoDataUrl: 'data:image/webp;base64,AAAA' };
    const remote = { photoStoragePath: 'users/u1/projectPhotos/y1/y1.webp' };
    expect(needsCoverMigration(local, remote, YARN_COVER)).toBe(false);
  });

  it('사진이 없으면 옮길 것도 없다', () => {
    expect(needsCoverMigration({}, {}, YARN_COVER)).toBe(false);
  });

  it('기기에 그림이 없으면 올릴 수 없다', () => {
    // 문서에만 있고 기기에 없으면 올릴 재료가 없다
    const remote = { photoDataUrl: 'data:image/webp;base64,AAAA' };
    expect(needsCoverMigration({}, remote, YARN_COVER)).toBe(false);
  });

  it('안 올라간 다이어리 사진을 찾아낸다', () => {
    expect(hasUnuploadedPhotos([photo({ storagePath: undefined })])).toBe(true);
    expect(hasUnuploadedPhotos([photo()])).toBe(false);
    expect(hasUnuploadedPhotos(undefined)).toBe(false);
  });

  it('지운 사진은 올리지 않는다', () => {
    expect(hasUnuploadedPhotos([photo({ storagePath: undefined, isDeleted: true })])).toBe(false);
  });
});
