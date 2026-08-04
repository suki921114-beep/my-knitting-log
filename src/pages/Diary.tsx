import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { groupByDate, formatLogDate } from '@/lib/logs';
import LogCard from '@/components/LogCard';
import { EmptyState } from '@/components/Mascot';
import { Plus } from 'lucide-react';

/**
 * 다이어리 — 모든 기록을 날짜순으로 모아 보는 화면.
 * 기록 자체는 프로젝트 상세에서 쓴 것과 같은 데이터다 (입구만 둘).
 */
export default function Diary() {
  const [filter, setFilter] = useState<number | 'all'>('all');

  const logs = useLiveQuery(
    () => db.logs.filter(l => !l.isDeleted).toArray(),
    [],
  ) || [];

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
      <header className="mb-1">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-primary/70">
          {streak > 0 ? `${streak}일째 기록 중` : '오늘의 뜨개'}
        </p>
        <h1 className="mt-0.5 text-[26px] font-extrabold leading-tight tracking-tight text-foreground">
          뜨개일기
        </h1>
      </header>

      <Link
        to="/diary/new"
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-soft"
      >
        <Plus className="h-4 w-4" /> 오늘 기록 남기기
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

      {groups.length === 0 ? (
        <div className="card-soft">
          <EmptyState
            title={filter === 'all' ? '아직 기록이 없어요' : '이 프로젝트의 기록이 없어요'}
            sub="한 줄이면 충분해요. 나중에 완성하고 나서 돌아보면 이게 제일 재밌어요."
            mood="sleepy"
          />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(g => (
            <section key={g.date} className="space-y-2">
              <h2 className="flex items-baseline gap-2 px-0.5">
                <span className="text-[13px] font-bold text-foreground">{formatLogDate(g.date)}</span>
                <span className="text-[10.5px] tabular-nums text-muted-foreground">{g.date}</span>
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
