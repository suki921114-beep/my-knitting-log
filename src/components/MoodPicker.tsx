import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  MOODS, firstGrapheme, isDefaultMood, isMoodLike, recentMoods, rememberMood,
} from '@/lib/mood';

interface Props {
  value?: string;
  onChange: (v: string | undefined) => void;
}

/**
 * 기분 고르기.
 *
 * 기본 이모지 + 직접 넣은 것들 + '기타'(＋) 버튼.
 * ＋ 를 누르면 칸이 하나 열리고, 거기서 폰 자판의 이모지를 쓴다.
 * 목록을 우리가 들고 있는 것보다 자판을 여는 쪽이 언제나 더 많다.
 */
export function MoodPicker({ value, onChange }: Props) {
  const [recent, setRecent] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  // localStorage 는 첫 그리기 뒤에 읽는다 — 서버에서 그릴 때 없는 물건이다
  useEffect(() => setRecent(recentMoods()), []);

  // 예전에 넣어둔 기분이 최근 목록에 없으면(다른 기기에서 썼거나 기억이
  // 지워졌거나) 그것도 같이 보여준다. 안 그러면 수정 화면에서 내가 고른
  // 것이 어디에도 안 보인다.
  const extras = [...recent];
  if (value && !isDefaultMood(value) && !extras.includes(value)) extras.unshift(value);

  function pick(m: string) {
    onChange(value === m ? undefined : m);
  }

  function commitDraft() {
    const m = firstGrapheme(draft);
    if (!m || !isMoodLike(m)) return;
    setRecent(rememberMood(m));
    onChange(m);
    setDraft('');
    setOpen(false);
  }

  const chip = (m: string) => (
    <button
      key={m}
      type="button"
      onClick={() => pick(m)}
      aria-pressed={value === m}
      className={`h-9 w-9 shrink-0 rounded-full text-[17px] transition ${
        value === m ? 'bg-primary/15 ring-2 ring-primary/50' : 'bg-secondary/60'
      }`}
    >
      {m}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-1.5">
      {MOODS.map(chip)}
      {extras.map(chip)}

      <Popover
        open={open}
        onOpenChange={o => {
          setOpen(o);
          if (!o) setDraft('');
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="기분 직접 넣기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed bg-secondary/30 text-muted-foreground hover:border-primary/50 hover:text-primary"
          >
            <Plus className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-3">
          <p className="mb-2 text-[12px] text-muted-foreground">
            자판의 이모지 버튼을 눌러 골라주세요.
          </p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitDraft();
                }
              }}
              placeholder="😍"
              aria-label="기분 이모지"
              className="h-10 w-14 rounded-xl border bg-background text-center text-[20px]"
            />
            <button
              type="button"
              onClick={commitDraft}
              disabled={!isMoodLike(draft)}
              className="h-10 flex-1 rounded-xl bg-primary text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              넣기
            </button>
          </div>
          {draft && !isMoodLike(draft) && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              글자 말고 이모지를 넣어주세요.
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
