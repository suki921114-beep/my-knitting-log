// ----------------------------------------------------------------------------
// 실 사용량 바로 고치기
// ----------------------------------------------------------------------------
// 뜨다 보면 "이 실 30g 더 썼다" 가 수시로 생긴다. 그때마다 프로젝트 수정
// 화면까지 들어갔다 나오는 건 기록을 안 하게 만드는 지름길이다.
//
// 그래서 숫자를 누르면 그 자리에서 고치게 한다. 프로젝트 상세와 실 상세
// 양쪽에서 같은 것을 쓴다 — 같은 값을 두 군데서 다르게 고치면 헷갈린다.
//
// ⚠️ 이 숫자는 링크 안에 들어간다. 누를 때 눌림을 멈추지 않으면 고치려다
//    실 화면으로 넘어가 버린다.

import { useEffect, useRef, useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { db, now } from '@/lib/db';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/sonner';

/** 한 번에 더하고 뺄 양 — 실 쓰는 단위에 가깝게 */
const STEPS = [-10, -5, 5, 10] as const;

interface Props {
  /** projectYarns 의 id */
  linkId: number;
  grams: number;
  /** 누구를 고치는지 — 팝오버 제목에 쓴다 */
  label?: string;
  className?: string;
}

export function UsedGramsEditor({ linkId, grams, label, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(grams));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 열 때마다 지금 값에서 시작한다. 다른 기기에서 바뀌었을 수도 있다.
  useEffect(() => {
    if (open) setDraft(String(grams));
  }, [open, grams]);

  const parsed = Number(draft);
  const valid = draft.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;

  function bump(delta: number) {
    const base = valid ? parsed : grams;
    // 음수로 내려가지 않는다. 쓴 양이 마이너스일 수는 없다.
    setDraft(String(Math.max(0, Math.round(base + delta))));
    inputRef.current?.focus();
  }

  async function save() {
    if (!valid || saving) return;
    const next = Math.round(parsed);
    if (next === grams) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await db.projectYarns.update(linkId, { usedGrams: next, updatedAt: now() });
      setOpen(false);
    } catch (e) {
      console.error('[UsedGramsEditor] 저장 실패', e);
      toast.error('저장하지 못했어요', { description: '잠시 후 다시 시도해 주세요.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          // 링크 안에 있으므로 눌림이 위로 올라가지 않게 막는다
          onClick={e => { e.preventDefault(); e.stopPropagation(); }}
          aria-label={`사용량 ${grams}그램 고치기`}
          className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-primary-soft/60 ${className}`}
        >
          {grams}g
          <Pencil className="h-3 w-3 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-60 p-3"
        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
      >
        <p className="mb-2 truncate text-[12px] font-medium text-foreground">
          {label ? `${label} · 사용량` : '사용량'}
        </p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              autoFocus
              type="number"
              inputMode="numeric"
              min={0}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); void save(); }
                if (e.key === 'Escape') setOpen(false);
              }}
              aria-label="사용량 (그램)"
              className="h-10 w-full rounded-xl border bg-background pl-3 pr-7 text-right text-[15px] outline-none focus:border-primary"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
              g
            </span>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!valid || saving}
            aria-label="저장"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>

        {/* 자판을 안 두드려도 되게. 실은 대개 5g, 10g 단위로 늘어난다 */}
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {STEPS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => bump(d)}
              className="rounded-lg bg-secondary/70 py-1.5 text-[12px] font-medium text-foreground hover:bg-secondary"
            >
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
