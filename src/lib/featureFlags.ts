// ----------------------------------------------------------------------------
// Feature flags
// ----------------------------------------------------------------------------
// 단순 boolean 상수. 빌드 시점에 결정되어 트리쉐이킹 가능.
// 나중에 환경변수 / 사용자 설정 / Remote Config 로 확장할 수 있도록 한 곳에 모음.

/**
 * 사진을 Firebase Storage 로 동기화할지 여부.
 *
 * 프로젝트 사진뿐 아니라 다이어리 사진과 실·도안·부자재 대표 이미지까지
 * 모두 이 값을 따른다. 끄면 사진은 기기에만 남는다.
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

/**
 * 자동 백업 UI 를 보여줄지.
 *
 * false — 추후 프리미엄 기능으로 검토 중이라 화면에서만 감춘다.
 * 로직(useAutoSync, syncRunner)은 그대로 두었으므로 true 로 바꾸면 바로 돌아온다.
 * 감춘 동안에는 자동 백업이 실행되지 않도록 훅 호출도 이 값으로 막는다.
 */
export const SHOW_AUTO_BACKUP = false;

/**
 * 백업/가져오기 후 항목별 수치 카드를 보여줄지.
 *
 * false — 일반 사용자에게는 필요 없는 정보다.
 * 동기화 문제를 파고들 때 true 로 바꾸면 다시 보인다.
 */
export const SHOW_SYNC_RESULT = false;
