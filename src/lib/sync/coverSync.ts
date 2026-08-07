// ----------------------------------------------------------------------------
// 대표 이미지 한 장짜리 항목의 동기화 (실 · 도안 · 부자재)
// ----------------------------------------------------------------------------
// 세 항목은 사진이 딱 한 장이고 생김새도 거의 같아서 절차를 한곳에 모았다.
// 세 파일에 같은 코드를 세 번 적어두면 한 곳만 고치고 두 곳을 잊게 된다.
//
// 예전에는 그림을 Firestore 문서 안에 글자로 박아 올렸다. 두 가지가 문제였다.
//   · 문서 하나는 1MB 를 못 넘는데, 500KB 사진은 글자로 바꾸면 670KB 다.
//     사진을 조금만 크게 넣으면 저장이 통째로 실패한다.
//   · 목록을 읽을 때마다 사진까지 딸려 와서 가져오기가 느려진다.
//
// 그래서 그림은 Storage 로 보내고 문서에는 '어디에 있는지' 만 남긴다.
// 다만 예전에 문서에 박아 올린 사진이 이미 있으므로, 받아올 때는 그것도
// 계속 읽어 준다. 안 그러면 예전 백업의 사진이 통째로 사라진다.

import { uploadCoverImage, downloadCoverImage } from './photoSync';
import type { StorageUsage } from '@/lib/quota';

/** 항목마다 그림을 담는 칸 이름이 다르다 */
export interface CoverField {
  /** 그림을 담는 칸 — 실·부자재는 photoDataUrl, 도안은 imageDataUrl */
  dataKey: 'photoDataUrl' | 'imageDataUrl';
  /** Storage 위치를 적는 칸 */
  pathKey: 'photoStoragePath' | 'imageStoragePath';
}

export const YARN_COVER: CoverField = { dataKey: 'photoDataUrl', pathKey: 'photoStoragePath' };
export const PATTERN_COVER: CoverField = { dataKey: 'imageDataUrl', pathKey: 'imageStoragePath' };
export const NOTION_COVER: CoverField = { dataKey: 'photoDataUrl', pathKey: 'photoStoragePath' };

export interface PreparedUpload<T> {
  /** 문서에 실을 것 — 그림은 빠지고 위치만 들어 있다 */
  payload: T;
  /** 기기에도 적어 둘 것 (Storage 위치). 없으면 적을 게 없다는 뜻. */
  localPatch?: Record<string, unknown>;
  usage: StorageUsage;
  usageChanged: boolean;
}

/**
 * 올리기 전에 그림을 Storage 로 보내고, 문서에 실을 모양을 만든다.
 *
 * 업로드가 실패하면 위치가 안 채워진 채로 넘어간다. 그림은 기기에 남아 있으니
 * 화면에서는 계속 보이고, 다음 백업에서 다시 시도된다.
 */
export async function prepareCoverUpload<T extends Record<string, any>>(
  userId: string,
  item: T,
  field: CoverField,
  usage: StorageUsage,
  context: string,
): Promise<PreparedUpload<T>> {
  const dataUrl: string | undefined = item[field.dataKey];
  const existingPath: string | undefined = item[field.pathKey];

  const result = await uploadCoverImage(
    userId,
    item.cloudId,
    dataUrl,
    existingPath,
    usage,
    context,
  );

  const payload: Record<string, any> = { ...item };
  // ⚠️ 그림은 문서에서 반드시 빼야 한다. 남겨두면 1MB 한도 문제가 그대로다.
  delete payload[field.dataKey];
  if (result.storagePath) payload[field.pathKey] = result.storagePath;
  else delete payload[field.pathKey];

  return {
    payload: payload as T,
    localPatch: result.usageChanged ? { [field.pathKey]: result.storagePath } : undefined,
    usage: result.usage,
    usageChanged: result.usageChanged,
  };
}

/**
 * 받아올 때 그림을 어디서 가져올지 정한다.
 *
 * 기기에 있으면 그대로, Storage 에 있으면 내려받고, 예전처럼 문서에 박혀
 * 있으면 그걸 쓴다.
 */
export async function resolveCover(
  localDataUrl: string | undefined,
  remote: Record<string, any>,
  field: CoverField,
  context: string,
): Promise<string | undefined> {
  return downloadCoverImage(
    localDataUrl,
    remote[field.pathKey],
    remote[field.dataKey],
    context,
  );
}
