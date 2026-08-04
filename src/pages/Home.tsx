import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now, Project, RowCounter } from '@/lib/db';
import { useAllYarnStats } from '@/lib/yarnCalc';
import { coverPhotoUrl } from '@/lib/photo';
import { formatLogDate } from '@/lib/logs';
import BackupReminder from '@/components/BackupReminder';
import Mascot, { EmptyState } from '@/components/Mascot';
import { Plus, Minus, PenLine, Image as ImageIcon, ArrowRight } from 'lucide-react';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '늦은 시간이네요';
  if (h < 11) return '좋은 아침이에요';
  if (h < 14) return '맛있는 점심 되세요';
  if (h < 18) return '편안한 오후예요';
  if (h < 22) return '저녁이 깊어가요';
  return '오늘도 수고했어요';
}

function vibrate(ms = 10) {
  try { (navigator as any).vibrate?.(ms); } catch { /* noop */ }
}

export default function Home() {
  const inProgress = useLiveQuery(
    () =>
      db.projects
        .where('status')
        .equals('in_progress')
        .filter(p => !p.isDeleted)
        .reverse()
        .sortBy('updatedAt'),
    [],
  );
  const allProjects = useLiveQuery(() => db.projects.filter(p => !p.isDeleted).toArray(), []) || [];
  const counters = useLiveQuery(() => db.rowCounters.filter(c => !c.isDeleted).toArray(), []) || [];
  const logs = useLiveQuery(() => db.logs.filter(l => !l.isDeleted).toArray(), []) || [];
  const yarnStats = useAllYarnStats() || [];

  /** 프로젝트별 대표 카운터 — 가장 최근에 만진 것 하나만 홈에 보여준다 */
  const counterByProject = useMemo(() => {
    const m = new Map<number, RowCounter>();
    for (const c of counters) {
      const prev = m.get(c.projectId);
      if (!prev || (c.updatedAt ?? 0) > (prev.updatedAt ?? 0)) m.set(c.projectId, c);
    }
    return m;
  }, [counters]);

  const projects = inProgress || [];
  const stats = {
    planned: allProjects.filter(p => p.status === 'planned').length,
    done: allProjects.filter(p => p.status === 'done').length,
  };
  const latestLog = useMemo(
    () => [...logs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))[0],
    [logs],
  );

  return (
    <div className="space-y-5">
      <BackupReminder />

      <header>
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-primary/70">
          {getGreeting()}
        </p>
        <h1 className="mt-0.5 text-[26px] font-extrabold leading-tight tracking-tight text-foreground">
          내 작업실
        </h1>
      </header>

      {projects.length === 0 ? (
        <div className="card-soft">
          <EmptyState
            title="아직 뜨고 있는 게 없네요"
            sub="지금 손에 잡고 있는 걸 하나 등록해 두면, 여기서 바로 단수를 셀 수 있어요."
            action={
              <Link to="/projects/new" className="btn-primary btn-sm">
                <Plus className="h-3.5 w-3.5" /> 첫 프로젝트 시작
              </Link>
            }
          />
        </div>
      ) : (
        <ProjectCarousel projects={projects} counterByProject={counterByProject} />
      )}

      {/* 한 줄 요약 — 상태 카드 4개를 대체 */}
      <p className="text-center text-[11.5px] text-muted-foreground">
        {[
          yarnStats.length > 0 && `실 ${yarnStats.length}타래`,
          stats.done > 0 && `완성 ${stats.done}개`,
          stats.planned > 0 && `예정 ${stats.planned}개`,
        ]
          .filter(Boolean)
          .join(' · ') || '실이나 도안을 등록해 보세요'}
      </p>

      <div className="flex gap-2">
        <Link
          to="/projects/new"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-[13px] font-bold text-primary-foreground shadow-soft"
        >
          <Plus className="h-4 w-4" /> 새 프로젝트
        </Link>
        <Link
          to="/library/yarns/new"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-secondary py-3 text-[13px] font-bold text-secondary-foreground"
        >
          실 추가
        </Link>
      </div>

      {/* 최근 기록 한 편만 — 나머지는 다이어리에서 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="section-title">최근 기록</h2>
          <Link to="/diary" className="flex items-center gap-0.5 text-[11.5px] text-muted-foreground">
            다이어리 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {latestLog ? (
          <Link to={`/diary/${latestLog.id}/edit`} className="card-soft block p-3.5">
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-semibold text-primary">
                {formatLogDate(latestLog.date)}
              </span>
              {latestLog.mood && <span className="text-[13px]">{latestLog.mood}</span>}
            </div>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink">{latestLog.text}</p>
          </Link>
        ) : (
          <Link
            to="/diary/new"
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-primary/40 bg-primary/5 py-3.5 text-[12.5px] font-semibold text-primary"
          >
            <PenLine className="h-3.5 w-3.5" /> 오늘 뭘 떴는지 적어볼까요?
          </Link>
        )}
      </section>
    </div>
  );
}

/** 진행 중 프로젝트를 좌우로 넘겨 보는 히어로 캐러셀 (문어발) */
function ProjectCarousel({
  projects,
  counterByProject,
}: {
  projects: Project[];
  counterByProject: Map<number, RowCounter>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx) setIdx(i);
  }

  return (
    <div>
      <div
        ref={ref}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {projects.map(p => (
          <div key={p.id} className="w-full shrink-0 snap-center">
            <HeroCard project={p} counter={counterByProject.get(p.id!)} />
          </div>
        ))}
      </div>

      {projects.length > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {projects.map((p, i) => (
            <span
              key={p.id}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? 'w-4 bg-primary' : 'w-1.5 bg-border'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HeroCard({ project, counter }: { project: Project; counter?: RowCounter }) {
  const nav = useNavigate();
  const cover = coverPhotoUrl(project.photos);
  const pct =
    counter?.goal && counter.goal > 0
      ? Math.min(100, Math.round((counter.count / counter.goal) * 100))
      : null;

  async function bump(delta: number) {
    if (!counter?.id) return;
    const next = Math.max(0, (counter.count ?? 0) + delta);
    if (next === counter.count) return;
    vibrate(delta > 0 ? 10 : 8);
    await db.rowCounters.update(counter.id, { count: next, updatedAt: now() });
  }

  return (
    <article className="card-soft overflow-hidden">
      <button
        type="button"
        onClick={() => nav(`/projects/${project.id}`)}
        className="block w-full text-left"
      >
        <div className="flex h-[150px] w-full items-center justify-center bg-primary-soft/60">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <Mascot size={68} className="text-primary/40" />
          )}
        </div>
        <div className="px-4 pt-3.5">
          <span className="chip bg-primary-soft text-primary">진행중</span>
          <h2 className="mt-2 truncate text-[16px] font-extrabold leading-tight text-foreground">
            {project.name}
          </h2>
        </div>
      </button>

      <div className="px-4 pb-4 pt-3">
        {counter ? (
          <>
            {pct !== null && (
              <div className="mb-2.5 h-[7px] overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[21px] font-extrabold tabular-nums text-foreground">
                  {counter.count}
                </span>
                <span className="ml-1 text-[11.5px] text-muted-foreground">
                  {counter.goal ? `/ ${counter.goal}단` : '단'}
                </span>
                <div className="truncate text-[10.5px] text-muted-foreground">{counter.name}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => bump(-1)}
                  aria-label="한 단 빼기"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground active:scale-95"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => bump(1)}
                  aria-label="한 단 더하기"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft active:scale-95"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => nav(`/projects/${project.id}`)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 py-2.5 text-[12px] font-semibold text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> 단수 카운터 만들기
          </button>
        )}

        <Link
          to={`/diary/new?projectId=${project.id}`}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-secondary/70 py-2.5 text-[12px] font-semibold text-secondary-foreground"
        >
          <PenLine className="h-3.5 w-3.5" /> 오늘 기록 남기기
        </Link>
      </div>
    </article>
  );
}
