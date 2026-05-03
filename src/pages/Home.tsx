import { askLocalAI } from "@/lib/ai/askLocalAI";
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAllYarnStats, statusLabel, statusColor } from '@/lib/yarnCalc';
import {
  Plus,
  Scroll,
  ArrowRight,
  Layers,
  Sparkles,
  Image as ImageIcon,
  Calculator,
  Notebook,
} from 'lucide-react';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '늦은 시간이네요';
  if (h < 11) return '좋은 아침이에요';
  if (h < 14) return '맛있는 점심 되세요';
  if (h < 18) return '편안한 오후예요';
  if (h < 22) return '저녁이 깊어가요';
  return '오늘도 수고했어요';
}

export default function Home() {
  const inProgress = useLiveQuery(
    () => db.projects.where('status').equals('in_progress').filter(p => !p.isDeleted).reverse().sortBy('updatedAt'),
    []
  );
  const allProjects = useLiveQuery(() => db.projects.filter(p => !p.isDeleted).toArray(), []) || [];
  const yarnStats = useAllYarnStats() || [];
  const topRemaining = yarnStats
    .filter(s => s.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 4);

  // 진행중 프로젝트별 카운터 — Home 카드에 작은 진행 표시
  const counters = useLiveQuery(() => db.rowCounters.filter(c => !c.isDeleted).toArray(), []) || [];
  const counterByProject = new Map<number, { count: number; goal?: number }>();
  for (const c of counters) {
    const existing = counterByProject.get(c.projectId);
    // 한 프로젝트에 카운터 여러 개면 가장 최근 업데이트된 것 우선
    if (!existing || (c.updatedAt ?? 0) > 0) {
      counterByProject.set(c.projectId, { count: c.count ?? 0, goal: c.goal });
    }
  }

  const stats = {
    planned: allProjects.filter(p => p.status === 'planned').length,
    inProgress: allProjects.filter(p => p.status === 'in_progress').length,
    done: allProjects.filter(p => p.status === 'done').length,
    onHold: allProjects.filter(p => p.status === 'on_hold').length,
  };

  const totalYarnGrams = yarnStats.reduce((acc, s) => acc + s.remaining, 0);
  const yarnCount = yarnStats.length;

  // 부드러운 한 줄 요약
  let summary: string;
  if (stats.inProgress > 0) {
    summary = `진행중 ${stats.inProgress}개${yarnCount > 0 ? ` · 실 ${yarnCount}타래` : ''}`;
  } else if (stats.planned > 0) {
    summary = `예정 ${stats.planned}개의 새 프로젝트가 기다리고 있어요`;
  } else if (yarnCount > 0) {
    summary = `등록된 실 ${yarnCount}타래 · 잔량 ${totalYarnGrams}g`;
  } else {
    summary = '첫 프로젝트나 실을 등록해 보세요';
  }

  return (
    <div className="space-y-6">
      {/* Hero — 시간대 인사 + 요약 */}
      <header className="space-y-1">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-primary/70">
          {getGreeting()}
        </p>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-foreground">
          내 작업실
        </h1>
        <p className="text-[12.5px] text-muted-foreground">{summary}</p>
      </header>

      {/* 프로젝트 상태 — 4 grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatLink to="/projects?status=planned" label="예정" value={stats.planned} tone="neutral" />
        <StatLink to="/projects?status=in_progress" label="진행중" value={stats.inProgress} tone="primary" />
        <StatLink to="/projects?status=done" label="완성" value={stats.done} tone="accent" />
        <StatLink to="/projects?status=on_hold" label="보류" value={stats.onHold} tone="muted" />
      </div>

      {/* 빠른 추가 — 4열 통합 (게이지 계산기 포함) */}
      <section>
        <h2 className="section-title mb-2.5">바로 추가</h2>
        <div className="grid grid-cols-4 gap-2">
          <QuickCard to="/projects/new" icon={Plus} label="프로젝트" tone="primary" />
          <QuickCard to="/library/yarns/new" icon={Layers} label="실" tone="accent" />
          <QuickCard to="/library/patterns/new" icon={Scroll} label="도안" tone="neutral" />
          <QuickCard to="/tools/gauge" icon={Calculator} label="게이지" tone="soft" />
        </div>
      </section>

      {/* 진행중 프로젝트 */}
      <Section title="오늘의 뜨개" to="/projects" cta="전체">
        {!inProgress?.length ? (
          <Empty
            icon={Notebook}
            text="지금 뜨고 있는 게 있나요?"
            sub="진행중 프로젝트를 등록하면 여기에 모입니다"
          />
        ) : (
          <div className="space-y-2">
            {inProgress.slice(0, 3).map(p => {
              const cover = (p.photos as any)?.[0]?.dataUrl;
              const counter = counterByProject.get(p.id!);
              const pct = counter?.goal && counter.goal > 0
                ? Math.min(100, Math.round((counter.count / counter.goal) * 100))
                : null;
              return (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="card-soft flex items-center gap-3 overflow-hidden p-2.5 transition active:scale-[0.99] hover:shadow-soft"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    {cover ? (
                      <img src={cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="img-placeholder"><ImageIcon className="h-4 w-4" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[14px] font-semibold text-foreground">{p.name}</h3>
                    {p.progressNote && (
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{p.progressNote}</p>
                    )}
                    {counter !== undefined && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="text-[10.5px] text-muted-foreground tabular-nums">
                          {counter.count}{counter.goal ? `/${counter.goal}` : ''}단
                        </div>
                        {pct !== null && (
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <span className={`chip ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      {/* 우선 사용할 실 */}
      <Section title="우선 사용할 실" to="/library/yarns" cta="실 보기">
        {!topRemaining.length ? (
          <Empty
            icon={Sparkles}
            text="등록된 실이 없어요"
            sub="첫 실을 등록하면 잔량 순으로 정리해 드려요"
          />
        ) : (
          <div className="space-y-2">
            {topRemaining.map(s => {
              const pct = s.yarn.totalGrams > 0
                ? Math.max(0, Math.min(100, (s.remaining / s.yarn.totalGrams) * 100))
                : 0;
              return (
                <Link
                  key={s.yarn.id}
                  to={`/library/yarns/${s.yarn.id}`}
                  className="card-soft flex items-center gap-3 p-2.5 transition active:scale-[0.99] hover:shadow-soft"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                    {s.yarn.photoDataUrl ? (
                      <img src={s.yarn.photoDataUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="img-placeholder"><ImageIcon className="h-4 w-4" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-foreground">{s.yarn.name}</div>
                    {s.yarn.brand && <div className="truncate text-[11.5px] text-muted-foreground">{s.yarn.brand}</div>}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">{Math.round(pct)}%</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-bold text-primary tabular-nums">
                      {s.remaining}
                      <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">/{s.yarn.totalGrams}g</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function StatLink({
  to,
  label,
  value,
  tone,
}: {
  to: string;
  label: string;
  value: number;
  tone: 'primary' | 'accent' | 'neutral' | 'muted';
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-primary-soft text-primary border-primary/15'
      : tone === 'accent'
      ? 'bg-accent-soft text-accent-foreground border-accent/20'
      : tone === 'muted'
      ? 'bg-muted text-muted-foreground border-border/40'
      : 'bg-secondary text-foreground border-border/30';
  return (
    <Link
      to={to}
      role="button"
      className={`group relative block rounded-2xl border px-3.5 py-3 transition-all active:scale-[0.97] hover:shadow-soft ${toneClass}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold opacity-80">{label}</span>
        <ArrowRight className="h-3 w-3 opacity-30 transition-opacity group-hover:opacity-70" />
      </div>
      <div className="mt-1.5 text-[24px] font-extrabold leading-none tracking-tight tabular-nums">
        {value}
      </div>
    </Link>
  );
}

function QuickCard({
  to,
  icon: Icon,
  label,
  tone,
}: {
  to: string;
  icon: any;
  label: string;
  tone: 'primary' | 'accent' | 'neutral' | 'soft';
}) {
  const iconClass =
    tone === 'primary'
      ? 'bg-primary text-primary-foreground'
      : tone === 'accent'
      ? 'bg-accent text-accent-foreground'
      : tone === 'soft'
      ? 'bg-primary-soft text-primary'
      : 'bg-foreground text-background';
  return (
    <Link
      to={to}
      className="card-soft flex flex-col items-center justify-center gap-1.5 py-3.5 text-center transition active:scale-[0.97] hover:-translate-y-0.5"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${iconClass}`}>
        <Icon className="h-4 w-4" strokeWidth={2.4} />
      </span>
      <span className="text-[11.5px] font-semibold text-foreground">{label}</span>
    </Link>
  );
}

function Section({
  title,
  to,
  cta,
  children,
}: {
  title: string;
  to?: string;
  cta?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="section-title">{title}</h2>
        {to && (
          <Link
            to={to}
            className="flex items-center gap-0.5 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            {cta || '전체'} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({
  icon: Icon,
  text,
  sub,
}: {
  icon: any;
  text: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-secondary/50 px-4 py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-[13px] font-semibold text-foreground">{text}</p>
      {sub && <p className="text-[11.5px] text-muted-foreground">{sub}</p>}
    </div>
  );
}



<button
  onClick={async () => {
    const result = await askLocalAI(
      "오늘 봄이 조끼 등판 15단 떴고, 4.5mm 바늘 사용했어"
    );

    console.log(result);
    alert(JSON.stringify(result, null, 2));
  }}
>
  로컬 AI 테스트
</button>