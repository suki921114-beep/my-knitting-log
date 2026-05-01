// ----------------------------------------------------------------------------
// Feature flags
// ----------------------------------------------------------------------------
// 단순 boolean 상수. 빌드 시점에 결정되어 트리쉐이킹 가능.
// 나중에 환경변수 / 사용자 설정 / Remote Config 로 확장할 수 있도록 한 곳에 모음.

/**
 * 프로젝트 사진을 Firebase Storage 로 동기화할지 여부.
 *
 * 현재 false — Firebase Storage 는 Blaze 요금제(과금)가 필요해서 1차에는
 * 사진을 로컬 Dexie 에만 저장한다. 다른 기기에서는 사진이 보이지 않는 것이
 * 현재 의도된 동작.
 *
 * 나중에 Storage(또는 다른 이미지 저장소) 를 켤 때:
 *   1) 이 값을 true 로 변경
 *   2) docs/firebase-storage-rules.md 의 보안 규칙 적용
 *   3) (선택) 다른 저장소 backend 면 src/lib/sync/photoStorage.ts 의 upload/download 만 교체
 */
export const ENABLE_CLOUD_PHOTO_SYNC = false;
