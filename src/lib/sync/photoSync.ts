// ----------------------------------------------------------------------------
// 사진을 클라우드에 올리고 받아오는 공통 절차
// ----------------------------------------------------------------------------
// 원래는 프로젝트 사진에만 이 절차가 있었다. 그런데 사진을 붙일 수 있는 곳은
// 프로젝트만이 아니다 — 다이어리, 실, 도안, 부자재에도 붙는다.
//
// 프로젝트 밖의 사진들은 두 가지로 갈려 있었다.
//   · 다이어리 사진 — 아무 데도 안 올라갔다. 기기를 바꾸면 사라졌다.
//   · 실·도안·부자재 사진 — Firestore 문서 안에 글자로 박혀 올라갔다.
//
// 뒤엣것이 특히 위험하다. 사진을 글자로 바꾸면 용량이 3분의 1쯤 불어나는데
// Firestore 문서 하나는 1MB 를 넘길 수 없다. 500KB 사진 한 장이면 글자로는
// 670KB — 한도에 바짝 붙는다. 게다가 문서를 읽을 때마다 사진까지 딸려 와서
// 가져오기가 느려지고, 보관료도 Storage 보다 몇 배 비싸다.
//
// 그래서 사진은 전부 Storage 로 보내고 문서에는 '어디에 있는지'만 남긴다.
//
// ⚠️ 저장 경로의 `projectPhotos` 는 이제 프로젝트 전용이 아니다.
//    이미 올라간 사진들이 그 경로에 있어서 이름만 그대로 두었다.
//    바꾸려면 파일을 전부 옮겨야 하는데 그럴 만한 이득이 없다.
//    storage.rules 도 이 경로를 기준으로 쓰여 있으니 함께 볼 것.

import type { ProjectPhoto } from '@/lib/db';
import { uploadPhotoDataUrl, downloadPhotoAsDataUrl } from './photoStorage';
import { reportSkippedPhoto, reportFailedPhotoDownload } from '@/lib/cloudUsage';
import { canUpload, dataUrlBytes, MAX_PHOTO_BYTES, type StorageUsage } from '@/lib/quota';
import { shrinkDataUrl } from '@/lib/image';
import { captureError } from '@/lib/errorLog';
import { ENABLE_CLOUD_PHOTO_SYNC } from '@/lib/featureFlags';

/** 문서에 실리는 사진 정보 — 실제 그림은 Storage 에 있다 */
export interface RemotePhoto {
  cloudId: string;
  storagePath: string;
  contentType?: string;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
  deletedAt: number | null;
}

export interface UploadPhotosResult {
  /** 기기에 다시 저장할 메타 — storagePath 가 채워진 상태 */
  photos: ProjectPhoto[];
  /** 문서에 실을 것 — 올라간 사진만 */
  payloads: RemotePhoto[];
  usage: StorageUsage;
  usageChanged: boolean;
}

/**
 * 클라우드 한 장 상한(2MB)을 넘는 사진을 줄인다.
 *
 * 상한을 넘으면 Storage 규칙에서도 막히므로 올릴 방법이 아예 없다.
 * 못 줄이면(브라우저가 못 읽는 형식) 원본을 그대로 돌려주고, 그때는
 * 기존대로 건너뛴다.
 */
async function shrinkForCloud(dataUrl: string, context: string): Promise<string> {
  if (dataUrlBytes(dataUrl) <= MAX_PHOTO_BYTES) return dataUrl;
  try {
    const smaller = await shrinkDataUrl(dataUrl, { maxDim: 1280, quality: 0.75, maxBytes: 800 * 1024 });
    if (smaller && smaller !== dataUrl) {
      console.info(
        `[${context}] 큰 사진을 줄였어요: ${dataUrlBytes(dataUrl)} → ${dataUrlBytes(smaller)} bytes`,
      );
      return smaller;
    }
  } catch (e) {
    console.warn(`[${context}] 사진 줄이기 실패`, e);
  }
  return dataUrl;
}

/** 빠진 값을 채워 온전한 사진 메타로 만든다 */
function normalize(ph: Partial<ProjectPhoto>): ProjectPhoto {
  const now = Date.now();
  return {
    cloudId: ph.cloudId || crypto.randomUUID(),
    dataUrl: ph.dataUrl,
    storagePath: ph.storagePath,
    contentType: ph.contentType,
    createdAt: ph.createdAt || now,
    updatedAt: ph.updatedAt || now,
    isDeleted: ph.isDeleted ?? false,
    deletedAt: ph.deletedAt ?? null,
  };
}

/**
 * 기기에는 있는데 아직 안 올라간 사진이 있는지.
 *
 * 백업은 '기기가 클라우드보다 새로울 때' 만 올린다. 사진을 안 올리던 시절에
 * 백업해 둔 기록들은 양쪽 시각이 같아 그냥 넘어가고, 사진은 영영 기기에만 남는다.
 * 이 경우를 찾아내 한 번 더 올리게 한다.
 */
export function hasUnuploadedPhotos(photos: ProjectPhoto[] | undefined): boolean {
  return !!photos?.some(p => !p.isDeleted && !!p.dataUrl && !p.storagePath);
}

export function toRemotePhoto(photo: ProjectPhoto): RemotePhoto | null {
  if (!photo.storagePath) return null;
  return {
    cloudId: photo.cloudId,
    storagePath: photo.storagePath,
    contentType: photo.contentType,
    createdAt: photo.createdAt,
    updatedAt: photo.updatedAt,
    isDeleted: photo.isDeleted ?? false,
    deletedAt: photo.deletedAt ?? null,
  };
}

/**
 * 아직 안 올라간 사진을 Storage 로 올린다.
 *
 * 한 장이 실패해도 나머지는 계속 올린다. 실패한 사진은 storagePath 없이
 * 기기에 그대로 남아 다음 백업에서 다시 시도된다 — 화면에서는 계속 보인다.
 */
export async function uploadPhotos(
  userId: string,
  ownerCloudId: string,
  input: Partial<ProjectPhoto>[],
  usage: StorageUsage,
  context: string,
): Promise<UploadPhotosResult> {
  const photos: ProjectPhoto[] = [];
  const payloads: RemotePhoto[] = [];
  const next: StorageUsage = { ...usage };
  let usageChanged = false;

  for (const raw of input) {
    const photo = normalize(raw);

    if (ENABLE_CLOUD_PHOTO_SYNC && !photo.storagePath && photo.dataUrl && !photo.isDeleted) {
      // 한 장 상한을 넘는 사진은 그냥 건너뛰지 않고 줄여서 올린다.
      // 크기 검사가 생기기 전에 들어온 사진들은 이대로 두면 영영 안 올라간다.
      // 줄인 결과는 photo 에 그대로 남아 기기에도 다시 저장된다 —
      // 다음 백업 때 또 줄이지 않아도 되고, 기기 저장 공간도 함께 준다.
      photo.dataUrl = await shrinkForCloud(photo.dataUrl, context);
      const bytes = dataUrlBytes(photo.dataUrl);
      const verdict = canUpload(next, bytes);

      if (!verdict.ok) {
        // 올리지 않을 뿐 기기에는 남는다. 용량이 생기면 다음 백업에서 다시 시도한다.
        reportSkippedPhoto(verdict.reason!);
      } else {
        try {
          photo.storagePath = await uploadPhotoDataUrl(userId, ownerCloudId, photo);
          photo.updatedAt = Date.now();
          next.bytes += bytes;
          next.photoCount += 1;
          usageChanged = true;
        } catch (e) {
          console.error(`[${context}] 사진 업로드 실패:`, e);
          captureError(
            `사진 업로드 실패 | ${ownerCloudId} | ${String((e as Error)?.message ?? e)}`,
            `${context}/photoUpload`,
          );
        }
      }
    }

    photos.push(photo);
    const payload = toRemotePhoto(photo);
    if (payload) payloads.push(payload);
  }

  return { photos, payloads, usage: next, usageChanged };
}

/**
 * 문서에 적힌 사진 중 기기에 없는 것만 받아온다.
 *
 * 이미 기기에 그림이 있으면 건드리지 않는다 — 같은 사진을 두 번 받을 이유가 없다.
 */
export async function downloadPhotos(
  remotePhotos: RemotePhoto[] | undefined,
  existing: ProjectPhoto[] | undefined,
  context: string,
): Promise<ProjectPhoto[]> {
  if (!remotePhotos?.length) return existing ?? [];

  const cached = new Map((existing ?? []).map(p => [p.cloudId, p]));
  const merged: ProjectPhoto[] = [];

  for (const remote of remotePhotos) {
    let dataUrl = cached.get(remote.cloudId)?.dataUrl;

    if (!dataUrl && remote.storagePath && !remote.isDeleted) {
      try {
        dataUrl = await downloadPhotoAsDataUrl(remote.storagePath, remote.contentType);
      } catch (e) {
        // 한 장이 실패해도 나머지는 계속 받는다. 대신 화면에 알린다 —
        // 조용히 넘어가면 사진이 원래 없는 줄 안다.
        reportFailedPhotoDownload();
        console.error(`[${context}] 사진 다운로드 실패:`, remote.storagePath, e);
        captureError(
          `사진 다운로드 실패 | ${remote.storagePath} | ${String((e as { code?: string })?.code ?? '')} ${String((e as Error)?.message ?? e)}`,
          `${context}/photoDownload`,
        );
      }
    }

    merged.push({
      cloudId: remote.cloudId,
      dataUrl,
      storagePath: remote.storagePath,
      contentType: remote.contentType,
      createdAt: remote.createdAt,
      updatedAt: remote.updatedAt,
      isDeleted: remote.isDeleted ?? false,
      deletedAt: remote.deletedAt ?? null,
    });
  }

  return merged;
}

// ----------------------------------------------------------------------------
// 대표 이미지 한 장 (실 · 도안 · 부자재)
// ----------------------------------------------------------------------------
// 이쪽은 사진이 한 장뿐이고 별도의 사진 id 도 없다. 항목의 cloudId 를 그대로
// 쓰면 경로가 겹치지 않는다.

export interface UploadCoverResult {
  storagePath?: string;
  /** 줄여서 올렸으면 줄인 그림. 기기에도 이 값으로 다시 저장해야 한다. */
  shrunkDataUrl?: string;
  usage: StorageUsage;
  usageChanged: boolean;
}

export async function uploadCoverImage(
  userId: string,
  ownerCloudId: string,
  dataUrl: string | undefined,
  existingPath: string | undefined,
  usage: StorageUsage,
  context: string,
): Promise<UploadCoverResult> {
  // 이미 올라가 있거나 올릴 그림이 없으면 그대로 둔다
  if (!ENABLE_CLOUD_PHOTO_SYNC || existingPath || !dataUrl) {
    return { storagePath: existingPath, usage, usageChanged: false };
  }

  // 한 장 상한을 넘으면 줄여서 올린다. 건너뛰면 영영 안 올라간다.
  const source = await shrinkForCloud(dataUrl, context);
  const shrunkDataUrl = source === dataUrl ? undefined : source;

  const bytes = dataUrlBytes(source);
  const verdict = canUpload(usage, bytes);
  if (!verdict.ok) {
    reportSkippedPhoto(verdict.reason!);
    return { storagePath: undefined, shrunkDataUrl, usage, usageChanged: false };
  }

  try {
    const path = await uploadPhotoDataUrl(userId, ownerCloudId, {
      cloudId: ownerCloudId,
      dataUrl: source,
      contentType: contentTypeOf(source),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: false,
      deletedAt: null,
    });
    return {
      storagePath: path,
      shrunkDataUrl,
      usage: { ...usage, bytes: usage.bytes + bytes, photoCount: usage.photoCount + 1 },
      usageChanged: true,
    };
  } catch (e) {
    console.error(`[${context}] 대표 이미지 업로드 실패:`, e);
    captureError(
      `대표 이미지 업로드 실패 | ${ownerCloudId} | ${String((e as Error)?.message ?? e)}`,
      `${context}/coverUpload`,
    );
    return { storagePath: undefined, shrunkDataUrl, usage, usageChanged: false };
  }
}

/**
 * 대표 이미지를 받아온다.
 *
 * 세 갈래를 다 받아준다.
 *   1. 기기에 이미 있으면 그대로 — 다시 받을 이유가 없다
 *   2. Storage 에 있으면 받아온다 — 지금 방식
 *   3. 문서 안에 글자로 박혀 있으면 그걸 쓴다 — 예전에 올린 것
 *
 * 3번을 남겨두지 않으면 예전에 백업해 둔 사진이 통째로 사라진다.
 */
export async function downloadCoverImage(
  localDataUrl: string | undefined,
  remoteStoragePath: string | undefined,
  remoteDataUrl: string | undefined,
  context: string,
): Promise<string | undefined> {
  if (localDataUrl) return localDataUrl;

  if (remoteStoragePath) {
    try {
      return await downloadPhotoAsDataUrl(remoteStoragePath);
    } catch (e) {
      reportFailedPhotoDownload();
      console.error(`[${context}] 대표 이미지 다운로드 실패:`, remoteStoragePath, e);
      captureError(
        `대표 이미지 다운로드 실패 | ${remoteStoragePath} | ${String((e as Error)?.message ?? e)}`,
        `${context}/coverDownload`,
      );
    }
  }

  return remoteDataUrl;
}

function contentTypeOf(dataUrl: string): string {
  const m = dataUrl.match(/^data:([^;]+);/);
  return m ? m[1] : 'image/jpeg';
}
