import {
  NEEDLE_KINDS,
  NEEDLE_SUBTYPES,
  NEEDLE_TIPS,
  hasSubType,
  type NeedleShape,
  type NeedleKind,
} from '@/lib/needleType';

/**
 * 바늘 종류 고르개.
 *
 * 라이브러리와 프로젝트의 빠른 추가에서 같은 것을 쓴다.
 * 두 곳이 따로 놀면 한쪽은 골라 담고 한쪽은 글로 적게 되어,
 * 결국 같은 바늘이 다른 종류로 갈라진다.
 */
export default function NeedleTypePicker({
  value,
  onChange,
  compact = false,
}: {
  value: NeedleShape;
  onChange: (next: NeedleShape) => void;
  /** 시트 안처럼 좁은 자리에서는 글씨와 여백을 줄인다 */
  compact?: boolean;
}) {
  const chip = compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs';
  const label = compact ? 'text-[10.5px]' : 'text-xs';

  function pickKind(kind: NeedleKind) {
    // 대바늘이 아니면 세부 갈래는 의미가 없으니 함께 비운다
    onChange(hasSubType(kind) ? { ...value, kind } : { kind, custom: value.custom });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {NEEDLE_KINDS.map(k => (
          <button
            key={k}
            type="button"
            onClick={() => pickKind(k)}
            className={`rounded-full border ${chip} ${
              value.kind === k
                ? 'border-primary bg-primary/10 font-semibold text-primary'
                : 'border-border text-muted-foreground'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {value.kind === '기타' && (
        <input
          className="w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          value={value.custom || ''}
          onChange={e => onChange({ ...value, custom: e.target.value })}
          placeholder="어떤 바늘인가요? (예: 레이스 바늘)"
        />
      )}

      {hasSubType(value.kind) && (
        <div className="space-y-2 rounded-xl bg-secondary/40 p-2.5">
          <div>
            <span className={`mb-1 block font-medium text-muted-foreground ${label}`}>형태</span>
            <div className="flex flex-wrap gap-1.5">
              {NEEDLE_SUBTYPES.map(s => (
                <button
                  key={s}
                  type="button"
                  // 한 번 더 누르면 선택을 푼다 — 모르는 것을 억지로 고르게 하지 않는다
                  onClick={() => onChange({ ...value, subType: value.subType === s ? undefined : s })}
                  className={`rounded-full border bg-card ${chip} ${
                    value.subType === s
                      ? 'border-primary bg-primary/10 font-semibold text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={`mb-1 block font-medium text-muted-foreground ${label}`}>팁 길이</span>
            <div className="flex flex-wrap gap-1.5">
              {NEEDLE_TIPS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChange({ ...value, tip: value.tip === t ? undefined : t })}
                  className={`rounded-full border bg-card ${chip} ${
                    value.tip === t
                      ? 'border-primary bg-primary/10 font-semibold text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
