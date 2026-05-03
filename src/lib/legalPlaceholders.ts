// ----------------------------------------------------------------------------
// 출시 전 채워야 할 placeholder 모음
// ----------------------------------------------------------------------------
// 정책/약관/About 페이지에 흩어져 있던 "TODO — 입력 필요" 문구를 한 곳으로 모아
// 출시 직전에 한 번에 갱신할 수 있게 한다.
//
// 출시 절차:
//   1) 아래 TODO 상수들 중 OPERATOR_EMAIL / OPERATOR_NAME / EFFECTIVE_DATE 를
//      실제 값으로 교체
//   2) HAS_TODO 가 false 가 되도록 모든 TODO_* 가 비어 있지 않게 만든다
//   3) 빌드/배포 후 정책 / 약관 / About 페이지 직접 확인
//
// HAS_TODO 가 true 일 때는 각 페이지에 빨간 'TODO' 배지가 떠 사용자에게도
// 공사중임을 명시한다 (출시 직후 모르고 노출되는 사고 방지).

const TODO_OPERATOR_EMAIL = '';   // 예: 'support@example.com'
const TODO_OPERATOR_NAME  = '';   // 예: 'OOO 개인 개발자'
const TODO_EFFECTIVE_DATE = '';   // 예: '2026-06-01'

export const OPERATOR_EMAIL: string | null = TODO_OPERATOR_EMAIL || null;
export const OPERATOR_NAME:  string | null = TODO_OPERATOR_NAME  || null;
export const EFFECTIVE_DATE: string | null = TODO_EFFECTIVE_DATE || null;

export const HAS_TODO_PLACEHOLDERS =
  !OPERATOR_EMAIL || !OPERATOR_NAME || !EFFECTIVE_DATE;

/**
 * 페이지에서 placeholder 자리에 표시할 fallback 문구 — '출시 전 입력 필요' 배지로 같이 노출.
 */
export const PLACEHOLDER_FALLBACK = '출시 전 입력 필요';
