// ----------------------------------------------------------------------------
// 게이지 입력 — 실과 도안이 함께 쓴다
// ----------------------------------------------------------------------------
// 실 수정 화면에 있던 것을 그대로 빼냈다. 도안에도 같은 칸이 필요한데,
// 코드를 두 벌 두면 한쪽만 고치고 다른 쪽을 잊게 된다.

import { Plus, Trash2, HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GAUGE_PATTERNS, GAUGE_WASH_STATES } from '@/lib/yarnCalc';
import { emptyGaugeRow, type GaugeRow } from '@/lib/gauge';

const inp = 'w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary';

interface Props {
  rows: GaugeRow[];
  onChange: (rows: GaugeRow[]) => void;
  /** 안내 문구 — 실과 도안이 다르다 */
  hint: string;
}

export default function GaugeRowsInput({ rows, onChange, hint }: Props) {
  function add() {
    // 다음 겹수를 미리 채워준다 — 대개 1겹 다음은 2겹이다
    const next = rows.reduce((max, r) => Math.max(max, Number(r.strands) || 0), 0) + 1;
    onChange([...rows, emptyGaugeRow(next)]);
  }
  function update(i: number, patch: Partial<GaugeRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {/* 안내는 물음표 뒤로 숨긴다. 늘 펼쳐 두면 두 번째부터는 안 읽히고
          자리만 차지한다 — 처음 한 번 궁금할 때 눌러 보면 된다. */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-muted-foreground">게이지 정보</span>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="게이지 정보 설명"
              className="rounded-full p-0.5 text-muted-foreground transition hover:bg-secondary hover:text-primary"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-3 text-[12px] leading-relaxed text-ink">
            {hint}
          </PopoverContent>
        </Popover>
      </div>

      {/* 한 줄에 다섯 칸을 욱여넣으니 폰에서 칸이 뭉개졌다. 그래서 두 줄로 나눈다.
          윗줄은 '어떤 조건에서 쟀는지', 아랫줄은 '잰 값'.

          ⚠️ 폭은 반드시 바깥 div 가 정할 것. inp 에 w-full 이 들어 있어서
             input·select 에 폭을 직접 붙이면 둘이 부딪혀 칸이 제멋대로 벌어진다.
             (한 번 이 문제로 화면이 통째로 무너진 적이 있다) */}
      {rows.map((r, i) => (
        <div key={i} className="space-y-1.5 rounded-2xl border border-border bg-secondary/25 p-2">
          {/* 윗줄 — 어떤 조건에서 잰 게이지인지 */}
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <select
                value={r.gaugePattern}
                onChange={e => update(i, { gaugePattern: e.target.value })}
                aria-label="메리야스 / 무늬"
                className={`${inp} appearance-none px-2 py-2 text-center text-[12.5px]`}
              >
                <option value="">메리야스/무늬</option>
                {GAUGE_PATTERNS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="min-w-0 flex-1">
              <select
                value={r.washState}
                onChange={e => update(i, { washState: e.target.value })}
                aria-label="세탁 전 / 세탁 후"
                className={`${inp} appearance-none px-2 py-2 text-center text-[12.5px]`}
              >
                <option value="">세탁 전/후</option>
                {GAUGE_WASH_STATES.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`${r.strands || ''}겹 지우기`}
              className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* 아랫줄 — 잰 값. 겹 · 바늘 · 코단 순으로 읽힌다 */}
          <div className="flex items-center gap-1.5">
            <div className="flex shrink-0 items-center gap-0.5">
              <div className="w-[2.75rem]">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  aria-label="겹수"
                  className={`${inp} px-1 py-2 text-center text-[13px]`}
                  value={r.strands}
                  onChange={e => update(i, { strands: e.target.value })}
                />
              </div>
              <span className="text-[12px] font-semibold text-muted-foreground">겹</span>
            </div>
            {/* 숫자만 받고 mm 는 칸 밖에 적는다 — '4.0mm' 를 통째로 적게 하면
                사람마다 4mm / 4.0 / 4호 로 갈려서 나중에 묶이지 않는다.
                ⚠️ type='number' 는 쓰지 않는다. 예전에 '5호' 처럼 적어둔 값이
                   빈 칸으로 보이면서 저장할 때 통째로 지워진다. */}
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              <input
                inputMode="decimal"
                aria-label="바늘 호수 (mm)"
                className={`${inp} px-2 py-2 text-center text-[13px]`}
                value={r.needleSize}
                onChange={e => update(i, { needleSize: e.target.value })}
                placeholder="4.0"
              />
              <span className="shrink-0 text-[12px] font-semibold text-muted-foreground">mm</span>
            </div>
            <div className="min-w-0 flex-[1.4]">
              <input
                className={`${inp} px-2.5 py-2 text-[13px]`}
                value={r.gauge}
                onChange={e => update(i, { gauge: e.target.value })}
                placeholder="22코 30단"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-2.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft/40 hover:text-primary"
      >
        <Plus className="h-4 w-4" /> 게이지 추가
      </button>
    </div>
  );
}
