// ----------------------------------------------------------------------------
// photoStorage — 프로젝트 사진을 Firebase Storage 와 주고받는 헬퍼
// ----------------------------------------------------------------------------
// 정책:
//   - dataURL ↔ Storage 변환만 담당 (Firestore 메타는 sync/project.ts 가 처리)
//   - Storage path: users/{uid}/projectPhotos/{projectCloudId}/{photoCloudId}.{ext}
//   - 업로드는 putString(dataUrl, 'data_url') 사용 (base64 추출 없이 바로)
//   - 다운로드는 getDownloadURL → fetch → blob → dataUrl 로 캐시
//   - Storage 보안 규칙: users/{uid} 본인 경로만 read/write (docs/firebase-storage-rules.md)

import { getDownloadURL, ref as storageRef, uploadString } from 'firebase/storage';
import { storage } from '../firebase';
import type { ProjectPhoto } from '../db';

function extToContentType(ct?: string): string {
  if (!ct) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  return 'jpg';
}

export function buildPhotoStoragePath(
  uid: string,
  projectCloudId: string,
  photo: Pick<ProjectPhoto, 'cloudId' | 'contentType'>,
): string {
  return `users/${uid}/projectPhotos/${projectCloudId}/${photo.cloudId}.${extToContentType(photo.contentType)}`;
}

/**
 * dataURL 사진을 Storage 에 업로드한다.
 * 성공 시 storagePath 반환. 실패는 throw.
 */
export async function uploadPhotoDataUrl(
  uid: string,
  projectCloudId: string,
  photo: ProjectPhoto,
): Promise<string> {
  if (!photo.dataUrl) throw new Error('photo.dataUrl 비어있음 — 업로드 불가');
  const path = buildPhotoStoragePath(uid, projectCloudId, photo);
  const r = storageRef(storage, path);
  // putString 의 'data_url' 모드는 'data:image/...;base64,...' 그대로 받음
  await uploadString(r, photo.dataUrl, 'data_url', {
    contentType: photo.contentType || 'image/jpeg',
  });
  return path;
}

/**
 * Storage 의 사진을 다운로드해서 dataURL 로 변환한다 (로컬 캐시용).
 * 실패는 throw.
 */
export async function downloadPhotoAsDataUrl(storagePath: string): Promise<string> {
  const r = storageRef(storage, storagePath);
  const url = await getDownloadURL(r);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
