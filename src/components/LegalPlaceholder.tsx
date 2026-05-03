// ----------------------------------------------------------------------------
// LegalPlaceholder — 출시 전 입력해야 할 자리 표시
// ----------------------------------------------------------------------------
// value 가 있으면 그대로 노출, 없으면 빨간 'TODO' 배지 + fallback 문구.
// 정책/약관/About 페이지의 placeholder 한 곳에서 통일된 톤으로 보이도록.

import { PLACEHOLDER_FALLBACK } from '@/lib/legalPlaceholders';

interface Props {
  value: string | null | undefined;
  /** value 가 비어 있을 때 보여줄 fallback. 기본 '출시 전 입력 필요'. */
  fallback?: string;
  /** display: bold 본문(기본) 또는 inline 작은 텍스트 */
  variant?: 'block' | 'inline';
}

export function LegalPlaceholder({
  value,
  fallback = PLACEHOLDER_FALLBACK,
  variant = 'block',
}: Props) {
  if (value) {
    if (variant === 'inline') {
      return <strong className="text-foreground">{value}</strong>;
    }
    return <span className="font-semibold text-foreground">{value}</span>;
  }
  // 비어있을 때 — 명확하게 빨간 배지 + 텍스트
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <span className="text-[9px] font-extrabold uppercase tracking-wider">TODO</span>
      {fallback}
    </span>
  );
}
