// ----------------------------------------------------------------------------
// 문어발 마스코트
// ----------------------------------------------------------------------------
// 뜨개하는 사람들이 여러 프로젝트를 동시에 벌여두는 걸 '문어발'이라 부르는 데서 왔다.
// 앱 아이콘과 같은 캐릭터를 빈 화면·안내에 재사용한다.

interface Props {
  /** 픽셀 크기 (정사각) */
  size?: number;
  /** 표정 */
  mood?: 'happy' | 'sleepy' | 'cheer';
  className?: string;
}

export default function Mascot({ size = 96, mood = 'happy', className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label="뜨개일기 문어 캐릭터"
    >
      {/* 다리 4개 — 8개를 다 그리면 작은 크기에서 뭉친다 */}
      <g fill="currentColor">
        <path d="M146 330 q-20 56 -52 74 q-16 9 -7 23 q10 14 26 5 q50 -29 71 -78 z" />
        <path d="M212 348 q-11 62 -32 94 q-9 16 6 23 q16 7 24 -8 q25 -46 34 -103 z" />
        <path d="M300 348 q11 62 32 94 q9 16 -6 23 q-16 7 -24 -8 q-25 -46 -34 -103 z" />
        <path d="M366 330 q20 56 52 74 q16 9 7 23 q-10 14 -26 5 q-50 -29 -71 -78 z" />
        <ellipse cx="256" cy="234" rx="126" ry="120" />
      </g>

      {/* 눈 */}
      {mood === 'sleepy' ? (
        <g stroke="#3B3147" strokeWidth="13" strokeLinecap="round" fill="none">
          <path d="M196 226 q16 -14 32 0" />
          <path d="M284 226 q16 -14 32 0" />
        </g>
      ) : mood === 'cheer' ? (
        <g stroke="#3B3147" strokeWidth="13" strokeLinecap="round" fill="none">
          <path d="M196 232 q16 -20 32 0" />
          <path d="M284 232 q16 -20 32 0" />
        </g>
      ) : (
        <g fill="#3B3147">
          <circle cx="212" cy="226" r="15" />
          <circle cx="300" cy="226" r="15" />
        </g>
      )}

      {/* 입 */}
      <path
        d={mood === 'sleepy' ? 'M240 274 q16 10 32 0' : 'M232 272 q24 24 48 0'}
        stroke="#3B3147"
        strokeWidth="13"
        fill="none"
        strokeLinecap="round"
      />

      {/* 볼 */}
      <ellipse cx="178" cy="264" rx="18" ry="11" fill="#F09BA0" opacity="0.8" />
      <ellipse cx="334" cy="264" rx="18" ry="11" fill="#F09BA0" opacity="0.8" />

      {/* 실 가닥 */}
      <path
        d="M382 300 q42 12 44 62"
        stroke="#F0CE73"
        strokeWidth="18"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 빈 화면용 — 캐릭터 + 문구 + (선택) 액션 */
export function EmptyState({
  title,
  sub,
  mood = 'happy',
  action,
}: {
  title: string;
  sub?: string;
  mood?: Props['mood'];
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <Mascot size={92} mood={mood} className="text-primary/35" />
      <p className="text-[14px] font-semibold text-foreground">{title}</p>
      {sub && <p className="max-w-[260px] text-[12px] leading-relaxed text-muted-foreground">{sub}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
