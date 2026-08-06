// ----------------------------------------------------------------------------
// 뜨개 도구 아이콘
// ----------------------------------------------------------------------------
// lucide 에는 실뭉치도, 대바늘도, 단추도 없다. 비슷한 걸 억지로 갖다 쓰면
// (실을 '겹겹', 바늘을 '자'로) 무엇인지 알아보기 어렵다. 그래서 직접 그린다.
//
// lucide 아이콘과 나란히 놓이므로 규격을 맞춘다 —
// 24 뷰박스, currentColor 선, strokeWidth 2, 둥근 끝.

interface Props {
  className?: string;
  strokeWidth?: number;
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** 실뭉치 — 동그란 덩어리에 감긴 결과 빠져나온 실 끝 */
export function YarnBallIcon({ className, strokeWidth = 2 }: Props) {
  return (
    <svg {...base} strokeWidth={strokeWidth} className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      {/* 감긴 결 — 두 방향으로 엇갈리게 */}
      <path d="M5.2 7.4 14.6 3.6" />
      <path d="M3.4 12.6 12.6 3.4" />
      <path d="M4.6 16.4 16.4 4.6" />
      <path d="M8.2 18.4 18.4 8.2" />
      <path d="M13 18.6 18.6 13" />
      {/* 빠져나온 실 끝 */}
      <path d="M17.2 16.4c1.8 1.1 2.6 2.8 2.3 4.6" />
    </svg>
  );
}

/** 대바늘 — 막대 두 개가 엇갈리고 끝에 마개 */
export function NeedlesIcon({ className, strokeWidth = 2 }: Props) {
  return (
    <svg {...base} strokeWidth={strokeWidth} className={className} aria-hidden="true">
      <path d="M4.5 20.5 17 8" />
      <circle cx="18.3" cy="6.7" r="1.9" />
      <path d="M19.5 20.5 7 8" />
      <circle cx="5.7" cy="6.7" r="1.9" />
    </svg>
  );
}

/** 단추 — 테두리 원과 실구멍 네 개 */
export function ButtonIcon({ className, strokeWidth = 2 }: Props) {
  return (
    <svg {...base} strokeWidth={strokeWidth} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6" opacity="0.45" />
      {/* 구멍은 선이 아니라 점이라 채워서 그린다 */}
      <g fill="currentColor" stroke="none">
        <circle cx="9.9" cy="9.9" r="1.05" />
        <circle cx="14.1" cy="9.9" r="1.05" />
        <circle cx="9.9" cy="14.1" r="1.05" />
        <circle cx="14.1" cy="14.1" r="1.05" />
      </g>
    </svg>
  );
}
