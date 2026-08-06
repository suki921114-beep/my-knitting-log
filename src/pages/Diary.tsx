import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { groupByDate, formatLogDate, formatLogDateFull, todayStr } from '@/lib/logs';
import LogCard from '@/components/LogCard';
import LogCalendar from '@/components/LogCalendar';
import { EmptyState } from '@/components/Mascot';
import { Plus, CalendarDays, List, PenLine } from 'lucide-react';

type ViewMode = 'calendar' | 'list';
const VIEW_KEY = 'diaryViewMode';

/**
 * 다이어리 — 모든 기록을 모아 보는 화면.
 * 달력과 목록 두 가지 보기를 제공하고 선택은 기억한다.
 * 기록 자체는 프로젝트 상세에서 쓴 것과 같은 데이터다 (입구만 둘).
 */
export default function Diary() {
  // 프로젝트 상세에서 '더보기'로 들어오면 그 프로젝트가 골라진 채로 열린다
  const [params] = useSearchParams();
  const fromProject = Number(params.get('projectId')) || null;

  const [view, setView] = useState<ViewMode>('calendar');
  const [filter, setFilter] = useState<number | 'all'>(fromProject ?? 'all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === 'calendar' || saved === 'list') setView(saved);
  }, []);

  function changeView(next: ViewMode) {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  }

  const logs = useLiveQuery(() => db.logs.filter(l => !l.isDeleted).toArray(), []) || [];
  const projects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const pmap = useMemo(() => new Map(projects.map(p => [p.id!, p])), [projects]);

  /** 기록이 하나라도 있는 프로젝트만 필터 칩으로 노출 */
  const usedProjects = useMemo(() => {
    const ids = new Set(logs.map(l => l.projectId).filter((v): v is number => v != null));
    return [...ids].map(id => pmap.get(id)).filter(Boolean);
  }, [logs, pmap]);

  const filtered = useMemo(
    () => (filter === 'all' ? logs : logs.filter(l => l.projectId === filter)),
    [logs, filter],
  );

  const groups = useMemo(() => groupByDate(filtered), [filtered]);
  const selectedLogs = useMemo(
    () => (selectedDate ? filtered.filter(l => l.date === selectedDate) : []),
    [filtered, selectedDate],
  );

  const streak = useMemo(() => {
    const dates = new Set(logs.map(l => l.date));
    let n = 0;
    const d = new Date();
    // 오늘 기록이 없으면 어제부터 센다 (오늘이 아직 안 끝났으므로)
    if (!dates.has(fmt(d))) d.setDate(d.getDate() - 1);
    while (dates.has(fmt(d))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }, [logs]);

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-primary/70">
            {streak > 0 ? `${streak}일째 기록 중` : '오늘의 뜨개'}
          </p>
          <h1 className="mt-0.5 text-[26px] font-extrabold leading-tight tracking-tight text-foreground">
            다이어리
          </h1>
        </div>

        {/* 보기 전환 */}
        <div className="flex rounded-full bg-secondary p-0.5">
          <ViewBtn active={view === 'calendar'} onClick={() => changeView('calendar')} label="달력 보기">
            <CalendarDays className="h-4 w-4" />
          </ViewBtn>
          <ViewBtn active={view === 'list'} onClick={() => changeView('list')} label="목록 보기">
            <List className="h-4 w-4" />
          </ViewBtn>
        </div>
      </header>

      <Link
        to={`/diary/new${selectedDate ? `?date=${selectedDate}` : ''}`}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-soft"
      >
        <Plus className="h-4 w-4" />
        {selectedDate && selectedDate !== todayStr()
          ? `${formatLogDate(selectedDate)}에 기록 남기기`
          : '오늘 기록 남기기'}
      </Link>

      {usedProjects.length > 0 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
            전체
          </Chip>
          {usedProjects.map(p => (
            <Chip key={p!.id} active={filter === p!.id} onClick={() => setFilter(p!.id!)}>
              {p!.name}
            </Chip>
          ))}
        </div>
      )}

      {logs.length === 0 ? (
        <div className="card-soft">
          <EmptyState
            title="아직 기록이 없어요"
            sub="한 줄이면 충분해요. 나중에 완성하고 나서 돌아보면 이게 제일 재밌어요."
            mood="sleepy"
          />
        </div>
      ) : view === 'calendar' ? (
        <div className="space-y-3">
          <LogCalendar logs={filtered} selected={selectedDate} onSelect={setSelectedDate} />

          {selectedDate ? (
            <section className="space-y-2">
              <h2 className="px-0.5 text-[13px] font-bold tabular-nums text-foreground">
                {formatLogDateFull(selectedDate)}
              </h2>
              {selectedLogs.length === 0 ? (
                <Link
                  to={`/diary/new?date=${selectedDate}`}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-primary/40 bg-primary/5 py-4 text-[12.5px] font-semibold text-primary"
                >
                  <PenLine className="h-3.5 w-3.5" /> 이 날의 기록 남기기
                </Link>
              ) : (
                <div className="space-y-2">
                  {selectedLogs.map(l => (
                    <LogCard
                      key={l.id}
                      log={l}
                      projectName={l.projectId ? pmap.get(l.projectId)?.name : undefined}
                      showProject={filter === 'all'}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : (
            /* 날짜를 안 고르면 그동안 쌓인 기록을 그대로 아래에 펼친다.
               달력만 덩그러니 있으면 뭘 눌러야 할지 몰라 그냥 나가게 된다. */
            <div className="space-y-5">
              <p className="px-1 text-center text-[11.5px] text-muted-foreground">
                날짜를 누르면 그날의 기록만 볼 수 있어요.
              </p>
              {groups.map(g => (
                <section key={g.date} className="space-y-2">
                  <h2 className="px-0.5 text-[13px] font-bold tabular-nums text-foreground">
                    {formatLogDateFull(g.date)}
                  </h2>
                  <div className="space-y-2">
                    {g.items.map(l => (
                      <LogCard
                        key={l.id}
                        log={l}
                        projectName={l.projectId ? pmap.get(l.projectId)?.name : undefined}
                        showProject={filter === 'all'}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : groups.length === 0 ? (
        <div className="card-soft">
          <EmptyState title="이 프로젝트의 기록이 없어요" mood="sleepy" />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(g => (
            <section key={g.date} className="space-y-2">
              <h2 className="px-0.5 text-[13px] font-bold tabular-nums text-foreground">
                {formatLogDateFull(g.date)}
              </h2>
              <div className="space-y-2">
                {g.items.map(l => (
                  <LogCard
                    key={l.id}
                    log={l}
                    projectName={l.projectId ? pmap.get(l.projectId)?.name : undefined}
                    showProject={filter === 'all'}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function fmt(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function ViewBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-8 w-9 items-center justify-center rounded-full transition ${
        active ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`max-w-[160px] shrink-0 truncate rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? 'border-primary bg-primary/10 font-semibold text-primary'
          : 'border-border text-muted-foreground'
      }`}
    >
      {children}
    </button>
  );
}
