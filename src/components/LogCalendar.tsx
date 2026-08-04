import { useMemo, useState } from 'react';
import { KnitLog } from '@/lib/db';
import { todayStr } from '@/lib/logs';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function ymd(y: number, m: number, d: number) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${y}-${p(m + 1)}-${p(d)}`;
}

/**
 * 월간 달력 — 기록이 있는 날에 표시가 뜬다.
 * 날짜를 누르면 선택되고, 그 날의 기록을 아래에서 보여 준다 (선택은 부모가 처리).
 */
export default function LogCalendar({
  logs,
  selected,
  onSelect,
}: {
  logs: KnitLog[];
  selected: string | null;
  onSelect: (date: string | null) => void;
}) {
  const today = todayStr();
  const [cursor, setCursor] = useState(() => {
    const base = selected ?? today;
    const [y, m] = base.split('-').map(Number);
    return { y, m: m - 1 };
  });

  /** 날짜별 기록 요약 — 개수와 대표 기분 */
  const byDate = useMemo(() => {
    const m = new Map<string, { count: number; mood?: string; rows: number }>();
    for (const l of logs) {
      const cur = m.get(l.date) || { count: 0, rows: 0 };
      cur.count += 1;
      cur.rows += l.rows ?? 0;
      if (!cur.mood && l.mood) cur.mood = l.mood;
      m.set(l.date, cur);
    }
    return m;
  }, [logs]);

  const { y, m } = cursor;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLogs = useMemo(
    () => logs.filter(l => l.date.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)),
    [logs, y, m],
  );
  const monthRows = monthLogs.reduce((acc, l) => acc + (l.rows ?? 0), 0);

  function move(delta: number) {
    const d = new Date(y, m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  }

  return (
    <div className="card-soft p-3.5">
      {/* 월 이동 */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="이전 달"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="text-[14px] font-bold text-foreground">
            {y}년 {m + 1}월
          </div>
          <div className="text-[10.5px] text-muted-foreground">
            {monthLogs.length > 0
              ? `${monthLogs.length}일 기록${monthRows > 0 ? ` · ${monthRows}단` : ''}`
              : '기록 없음'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="다음 달"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 요일 */}
      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`text-center text-[10.5px] font-semibold ${
              i === 0 ? 'text-destructive/70' : i === 6 ? 'text-primary/70' : 'text-muted-foreground'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const date = ymd(y, m, d);
          const info = byDate.get(date);
          const isToday = date === today;
          const isSelected = date === selected;

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(isSelected ? null : date)}
              className="flex flex-col items-center gap-0.5 py-1"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] tabular-nums transition ${
                  isSelected
                    ? 'bg-primary font-bold text-primary-foreground'
                    : info
                    ? 'bg-primary-soft font-bold text-primary'
                    : isToday
                    ? 'font-bold text-primary ring-1 ring-primary/40'
                    : 'text-muted-foreground'
                }`}
              >
                {info?.mood && !isSelected ? (
                  <span className="text-[14px] leading-none">{info.mood}</span>
                ) : (
                  d
                )}
              </span>
              {/* 기록 2편 이상이면 점으로 표시 */}
              <span className="flex h-1 gap-0.5">
                {info && info.count > 1 && (
                  <>
                    <i className="h-1 w-1 rounded-full bg-primary/50" />
                    <i className="h-1 w-1 rounded-full bg-primary/50" />
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
