// ----------------------------------------------------------------------------
// 도안 PDF 를 Firebase Storage 와 주고받기
// ----------------------------------------------------------------------------
// 사진(photoStorage.ts)과 나눠 둔 이유가 둘이다.
//   · 사진은 글자(dataURL)로 다루지만 PDF 는 파일 그대로 다룬다.
//     3~10MB 짜리를 base64 로 바꾸면 3분의 1이 더 붙고 메모리도 그만큼 든다.
//   · 경로가 다르면 보안 규칙도 따로 걸 수 있다 — PDF 만 30MB 까지 허용하고
//     사진은 2MB 로 묶어 둘 수 있다.
//
// 경로: users/{uid}/patternFiles/{patternCloudId}/{fileCloudId}.pdf
//   도안 하나에 파일이 여럿일 수 있다 — 차트 따로, 사이즈 옵션 따로.
//   도안 cloudId 로 폴더를 만들고 그 안에 파일 id 로 담는다.
//   파일 id 를 안 쓰면 두 번째 파일이 첫 번째를 덮어쓴다.
//
// ⚠️ storage.rules 에 이 경로가 열려 있어야 한다. 규칙을 게시하지 않으면
//    업로드가 storage/unauthorized 로 막힌다.

import { getBytes, ref as storageRef, uploadBytes, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

export function buildPatternFilePath(uid: string, patternCloudId: string, fileCloudId: string): string {
  return `users/${uid}/patternFiles/${patternCloudId}/${fileCloudId}.pdf`;
}

/** 도안의 파일 폴더 — 도안을 통째로 지울 때 쓴다 */
export function patternFileFolder(uid: string, patternCloudId: string): string {
  return `users/${uid}/patternFiles/${patternCloudId}`;
}

/** 올리고 저장된 자리를 돌려준다. 실패는 throw. */
export async function uploadPatternFile(
  uid: string,
  patternCloudId: string,
  fileCloudId: string,
  blob: Blob,
): Promise<string> {
  const path = buildPatternFilePath(uid, patternCloudId, fileCloudId);
  await uploadBytes(storageRef(storage, path), blob, { contentType: 'application/pdf' });
  return path;
}

/**
 * 받아온다. 실패는 throw.
 *
 * getDownloadURL + fetch 대신 getBytes 를 쓴다 — 실패했을 때 브라우저가
 * "Failed to fetch" 만 던지면 권한 문제인지 네트워크 문제인지 알 수 없다.
 * getBytes 는 storage/unauthorized 같은 코드를 그대로 올려 준다.
 */
export async function downloadPatternFile(storagePath: string): Promise<Blob> {
  const bytes = await getBytes(storageRef(storage, storagePath));
  return new Blob([bytes], { type: 'application/pdf' });
}

/** 지운다. 이미 없으면 조용히 넘어간다. */
export async function deletePatternFileObject(storagePath: string): Promise<void> {
  try {
    await deleteObject(storageRef(storage, storagePath));
  } catch (e) {
    // 이미 지워졌거나 권한이 없어도 로컬 삭제까지 막을 이유는 없다
    console.warn('[patternFileStorage] 삭제 실패:', storagePath, e);
  }
}
