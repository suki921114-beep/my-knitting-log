import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAllYarnStats, statusLabel, statusColor } from '@/lib/yarnCalc';
import { Plus, Scroll, ArrowRight, Layers, Sparkles, Image as ImageIcon, Calculator } from 'lucide-react';

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

  const stats = {
    planned: allProjects.filter(p => p.status === 'planned').length,
    inProgress: allProjects.filter(p => p.status === 'in_progress').length,
    done: allProjects.filter(p => p.status === 'done').length,
    onHold: allProjects.filter(p => p.status === 'on_hold').length,
  };

  return (
    <div className="space-y-6">
      {/* Atelier hero */}
      <header>
        <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-foreground">내 작업실</h1>
      </header>

      {/* Mini stats — project status */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatLink to="/projects?status=planned" label="예정" value={stats.planned} tone="neutral" />
        <StatLink to="/projects?status=in_progress" label="진행중" value={stats.inProgress} tone="primary" />
        <StatLink to="/projects?status=done" label="완성" value={stats.done} tone="accent" />
        <StatLink to="/projects?status=on_hold" label="보류" value={stats.onHold} tone="muted" />
      </div>

      {/* Quick actions */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="section-title">바로 추가</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <QuickCard to="/projects/new" icon={Plus} label="프로젝트" tone="primary" />
          <QuickCard to="/library/yarns/new" icon={Layers} label="실" tone="accent" />
          <QuickCard to="/library/patterns/new" icon={Scroll} label="도안" tone="neutral" />
        </div>

        <Link
          to="/tools/gauge"
          className="card-soft press-tile mt-2 flex items-center gap-3 p-3.5 hover:shadow-soft"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Calculator className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold text-foreground">게이지 계산기</div>
            <div className="text-[11.5px] text-muted-foreground">도안 게이지를 내 게이지로 보정해요</div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>

      {/* In-progress */}
      <Section title="오늘의 뜨개" to="/projects" cta="전체">
        {!inProgress?.length ? (
          <Empty icon={Sparkles} text="진행중인 작업이 없어요" />
        ) : (
          <div className="space-y-2">
            {inProgress.slice(0, 3).map(p => {
              const cover = p.photos?.[0];
              return (
                <Link key={p.id} to={`/projects/${p.id}`} className="card-soft flex items-center gap-3 overflow-hidden p-2.5 hover:shadow-soft">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    {cover ? (
                      <img src={cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="img-placeholder"><ImageIcon className="h-4 w-4" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[14px] font-semibold text-foreground">{p.name}</h3>
                    {p.progressNote && <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{p.progressNote}</p>}
                  </div>
                  <span className={`chip ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      {/* Top remaining — yarns to use up first */}
      <Section title="우선 사용할 실" to="/library/yarns" cta="실 보기">
        {!topRemaining.length ? (
          <Empty icon={Sparkles} text="등록된 실이 없어요" />
        ) : (
          <div className="space-y-2">
            {topRemaining.map(s => {
              const pct = s.yarn.totalGrams > 0
                ? Math.max(0, Math.min(100, (s.remaining / s.yarn.totalGrams) * 100))
                : 0;
              return (
                <Link key={s.yarn.id} to={`/library/yarns/${s.yarn.id}`} className="card-soft flex items-center gap-3 p-2.5 hover:shadow-soft">
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
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-bold text-primary tabular-nums">{s.remaining}<span className="ml-0.5 text-[11px] font-normal text-muted-foreground">/{s.yarn.totalGrams}g</span></div>
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

function StatLink({ to, label, value, tone }: { to: string; label: string; value: number; tone: 'primary' | 'accent' | 'neutral' | 'muted' }) {
  const toneClass =
    tone === 'primary' ? 'bg-primary-soft text-primary' :
    tone === 'accent' ? 'bg-accent-soft text-accent-foreground' :
    tone === 'muted' ? 'bg-muted text-muted-foreground' :
    'bg-secondary text-foreground';
  return (
    <Link
      to={to}
      role="button"
      className={`press-tile group relative block rounded-2xl px-3.5 py-3 hover:shadow-soft ${toneClass}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold opacity-75">{label}</span>
        <ArrowRight className="h-3 w-3 opacity-40 transition-opacity group-hover:opacity-80" />
      </div>
      <div className="mt-1.5 text-[22px] font-extrabold leading-none tracking-tight tabular-nums">{value}</div>
    </Link>
  );
}

function QuickCard({ to, icon: Icon, label, tone }: { to: string; icon: any; label: string; tone: 'primary' | 'accent' | 'neutral' }) {
  const iconClass =
    tone === 'primary' ? 'bg-primary text-primary-foreground' :
    tone === 'accent' ? 'bg-accent text-accent-foreground' :
    'bg-foreground text-background';
  return (
    <Link
      to={to}
      className="card-soft flex flex-col items-center justify-center gap-2 py-4 text-center transition hover:-translate-y-0.5"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${iconClass}`}>
        <Icon className="h-4 w-4" strokeWidth={2.4} />
      </span>
      <span className="text-[12px] font-semibold text-foreground">{label}</span>
    </Link>
  );
}

function Section({ title, to, cta, children }: { title: string; to?: string; cta?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="section-title">{title}</h2>
        {to && (
          <Link to={to} className="flex items-center gap-0.5 text-[11.5px] font-semibold text-muted-foreground hover:text-primary">
            {cta || '전체'} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-secondary/60 px-4 py-8 text-center">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <p className="text-[12.5px] text-muted-foreground">{text}</p>
    </div>
  );
}
