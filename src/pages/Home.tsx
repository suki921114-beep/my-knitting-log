import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAllYarnStats, statusLabel, statusColor } from '@/lib/yarnCalc';
import { Plus, Scroll, AlertTriangle, ArrowRight, Layers, Sparkles, Image as ImageIcon } from 'lucide-react';

export default function Home() {
  const inProgress = useLiveQuery(
    () => db.projects.where('status').equals('in_progress').reverse().sortBy('updatedAt'),
    []
  );
  const allProjects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const yarnStats = useAllYarnStats() || [];
  const lowStock = yarnStats
    .filter(s => s.remaining <= Math.max(20, s.yarn.totalGrams * 0.1))
    .sort((a, b) => a.remaining - b.remaining)
    .slice(0, 4);

  const stats = {
    inProgress: allProjects.filter(p => p.status === 'in_progress').length,
    done: allProjects.filter(p => p.status === 'done').length,
    yarns: yarnStats.length,
  };

  return (
    <div className="space-y-6">
      {/* Atelier hero */}
      <header>
        <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-foreground">내 작업실</h1>
      </header>

      {/* Mini stats — clickable */}
      <div className="grid grid-cols-3 gap-2">
        <StatLink to="/projects?status=in_progress" label="진행중" value={stats.inProgress} tone="primary" />
        <StatLink to="/projects?status=done" label="완성" value={stats.done} tone="accent" />
        <StatLink to="/library/yarns" label="실 종류" value={stats.yarns} tone="neutral" />
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
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
                    {cover ? (
                      <img src={cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                      </div>
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

      {/* Low stock */}
      <Section title="재고 알림" to="/library/yarns" cta="실 보기">
        {!lowStock.length ? (
          <Empty icon={Sparkles} text="재고가 모두 넉넉해요" />
        ) : (
          <div className="space-y-2">
            {lowStock.map(s => (
              <Link key={s.yarn.id} to={`/library/yarns/${s.yarn.id}`} className="card-soft flex items-center gap-3 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                  <AlertTriangle className="h-4 w-4 text-accent-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-foreground">{s.yarn.name}</div>
                  {s.yarn.brand && <div className="truncate text-[11.5px] text-muted-foreground">{s.yarn.brand}</div>}
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-bold text-primary">{s.remaining}<span className="ml-0.5 text-[11px] font-normal text-muted-foreground">/{s.yarn.totalGrams}g</span></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function StatLink({ to, label, value, tone }: { to: string; label: string; value: number; tone: 'primary' | 'accent' | 'neutral' }) {
  const toneClass =
    tone === 'primary' ? 'bg-primary-soft text-primary' :
    tone === 'accent' ? 'bg-accent-soft text-accent-foreground' :
    'bg-secondary text-foreground';
  return (
    <Link
      to={to}
      className={`block rounded-2xl px-3.5 py-3 transition active:scale-[0.97] hover:shadow-soft ${toneClass}`}
    >
      <div className="text-[11px] font-semibold opacity-80">{label}</div>
      <div className="mt-1 text-[22px] font-extrabold leading-none tracking-tight">{value}</div>
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
