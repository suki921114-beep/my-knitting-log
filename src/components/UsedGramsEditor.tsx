// ----------------------------------------------------------------------------
// 실 사용량 바로 고치기
// ----------------------------------------------------------------------------
// 뜨다 보면 "이 실 30g 더 썼다" 가 수시로 생긴다. 그때마다 프로젝트 수정
// 화면까지 들어갔다 나오는 건 기록을 안 하게 만드는 지름길이다.
//
// 단수 카운터와 같은 방식으로 둔다 — 숫자를 바로 누르고 고친다. 연필을 먼저
// 누르거나 창이 뜨는 단계를 넣으면, 한 손에 바늘을 든 사람에게는 그 한 번이
// 곧 '나중에 하자' 가 된다.
//
// ⚠️ 이 칸을 링크(<a>) 안에 넣지 말 것. 누르는 순간 링크가 따라가서 고칠 수가
//    없다. 링크는 줄의 글자 부분만 감싸고, 이것은 그 옆에 형제로 둔다.

import { useEffect, useRef, useState } from 'react';
import { db, now } from '@/lib/db';
import { toast } from '@/components/ui/sonner';

interface Props {
  /** projectYarns 의 id */
  linkId: number;
  grams: number;
  className?: string;
}

export function UsedGramsEditor({ linkId, grams, className = '' }: Props) {
  const [draft, setDraft] = useState(String(grams));
  const editing = useRef(false);

  // 다른 화면에서 값이 바뀌면 따라온다. 단, 지금 고치는 중이면 손대지 않는다 —
  // 두 글자 치는 사이에 값이 되돌아가면 숫자를 넣을 수가 없다.
  useEffect(() => {
    if (!editing.current) setDraft(String(grams));
  }, [grams]);

  async function save() {
    editing.current = false;
    const parsed = Number(draft);

    // 빈칸이거나 숫자가 아니면 없던 일로 하고 되돌린다.
    // 실수로 지운 것을 0 으로 저장해 버리면 잔여량이 통째로 틀어진다.
    if (draft.trim() === '' || !Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(grams));
      return;
    }

    const next = Math.round(parsed);
    if (next === grams) {
      setDraft(String(next));
      return;
    }

    try {
      await db.projectYarns.update(linkId, { usedGrams: next, updatedAt: now() });
    } catch (e) {
      console.error('[UsedGramsEditor] 저장 실패', e);
      toast.error('저장하지 못했어요', { description: '잠시 후 다시 시도해 주세요.' });
      setDraft(String(grams));
    }
  }

  return (
    <span className={`inline-flex shrink-0 items-center gap-0.5 ${className}`}>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={draft}
        onFocus={e => { editing.current = true; e.currentTarget.select(); }}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setDraft(String(grams)); e.currentTarget.blur(); }
        }}
        aria-label="사용량 (그램)"
        // 위아래 화살표는 지운다. 좁은 칸에서 자리만 먹고, 뜨는 중에 잘못 눌린다.
        className="w-12 rounded-lg border border-input bg-card px-1 py-0.5 text-right tabular-nums outline-none focus:border-ring/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span aria-hidden>g</span>
    </span>
  );
}
