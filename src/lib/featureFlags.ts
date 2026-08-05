// ----------------------------------------------------------------------------
// Feature flags
// ----------------------------------------------------------------------------
// 단순 boolean 상수. 빌드 시점에 결정되어 트리쉐이킹 가능.
// 나중에 환경변수 / 사용자 설정 / Remote Config 로 확장할 수 있도록 한 곳에 모음.

/**
 * 프로젝트 사진을 Firebase Storage 로 동기화할지 여부.
 *
 * true — 폰과 태블릿에서 같은 사진을 보려면 필요하다.
 *
 * 비용은 1인당 상한(src/lib/quota.ts 의 FREE_QUOTA_BYTES)으로 묶는다.
 * 상한을 넘으면 업로드만 건너뛰고 로컬 사진은 그대로 남는다.
 *
 * 켜기 전에 반드시 끝내야 하는 것 (docs/photo-cloud-backup.md):
 *   1) Firebase 프로젝트를 Blaze 로 전환 (2026-02-03 이후 Storage 필수 조건)
 *   2) Google Cloud 예산 알림 설정 — 마지막 안전장치
 *   3) storage.rules 게시 (본인 경로만 / 장당 크기 제한 / 총량 제한)
 *
 * 저장소를 다른 것으로 바꾸려면 src/lib/sync/photoStorage.ts 의
 * upload/download 두 함수만 교체하면 된다.
 */
export const ENABLE_CLOUD_PHOTO_SYNC = true;
