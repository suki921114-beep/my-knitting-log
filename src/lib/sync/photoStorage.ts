// ----------------------------------------------------------------------------
// photoStorage — 사진을 Firebase Storage 와 주고받는 헬퍼
// ----------------------------------------------------------------------------
// 정책:
//   - dataURL ↔ Storage 변환만 담당 (문서에 뭘 적을지는 sync/photoSync.ts 가 정한다)
//   - Storage path: users/{uid}/projectPhotos/{ownerCloudId}/{photoCloudId}.{ext}
//
// ⚠️ 경로의 `projectPhotos` 는 이제 프로젝트 전용이 아니다. 다이어리·실·도안·
//    부자재 사진도 같은 경로를 쓴다. 이미 올라간 사진들이 여기 있어서 이름만
//    그대로 두었다 — 바꾸려면 파일을 전부 옮겨야 하고 얻는 게 없다.
//    storage.rules 도 이 경로 기준이니 함께 볼 것.
//   - 업로드는 putString(dataUrl, 'data_url') 사용 (base64 추출 없이 바로)
//   - 다운로드는 getDownloadURL → fetch → blob → dataUrl 로 캐시
//   - Storage 보안 규칙: users/{uid} 본인 경로만 read/write (docs/firebase-storage-rules.md)

import { getBytes, ref as storageRef, uploadString } from 'firebase/storage';
import { storage } from '../firebase';
import type { ProjectPhoto } from '../db';

function extToContentType(ct?: string): string {
  if (!ct) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  return 'jpg';
}

/** 파일 확장자로 MIME 을 되돌린다 (업로드 시 붙인 확장자와 짝) */
function guessContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

export function buildPhotoStoragePath(
  uid: string,
  ownerCloudId: string,
  photo: Pick<ProjectPhoto, 'cloudId' | 'contentType'>,
): string {
  return `users/${uid}/projectPhotos/${ownerCloudId}/${photo.cloudId}.${extToContentType(photo.contentType)}`;
}

/**
 * dataURL 사진을 Storage 에 업로드한다.
 * 성공 시 storagePath 반환. 실패는 throw.
 */
export async function uploadPhotoDataUrl(
  uid: string,
  ownerCloudId: string,
  photo: ProjectPhoto,
): Promise<string> {
  if (!photo.dataUrl) throw new Error('photo.dataUrl 비어있음 — 업로드 불가');
  const path = buildPhotoStoragePath(uid, ownerCloudId, photo);
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
 *
 * 예전에는 getDownloadURL 로 URL 을 받아 fetch 했는데, 그러면 실패했을 때
 * 브라우저가 "Failed to fetch" 만 던져 원인을 알 수 없다(CORS 인지 권한인지
 * 네트워크인지 구분 불가). getBytes 는 SDK 가 직접 받아오므로
 * storage/unauthorized 같은 코드가 그대로 올라온다.
 *
 * ⚠️ 어느 방식이든 브라우저에서 받으려면 버킷에 CORS 설정이 있어야 한다.
 *    앱(Capacitor) 의 출처는 https://localhost 다 — storage-cors.json 참고.
 */
export async function downloadPhotoAsDataUrl(
  storagePath: string,
  contentType?: string,
): Promise<string> {
  const r = storageRef(storage, storagePath);
  const bytes = await getBytes(r);
  // ⚠️ type 을 빼면 data:application/octet-stream 이 되어 <img> 가 표시하지 못한다.
  //    메타에 없으면 확장자에서 유추한다.
  const blob = new Blob([bytes], { type: contentType || guessContentType(storagePath) });
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
