import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useAllYarnStats, statusLabel, statusColor } from '@/lib/yarnCalc';
import PageHeader from '@/components/PageHeader';
import PrivacyNote from '@/components/PrivacyNote';
import { Plus, Notebook, Spool, Scroll, AlertTriangle, ArrowRight } from 'lucide-react';

// lucide doesn't have Spool — fallback to a knit-friendly icon
import { Layers } from 'lucide-react';

export default function Home() {
  const inProgress = useLiveQuery(
    () => db.projects.where('status').equals('in_progress').reverse().sortBy('updatedAt'),
    []
  );
  const recent = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().limit(5).toArray(), []);
  const yarnStats = useAllYarnStats();
  const lowStock = (yarnStats || []).filter(s => s.remaining <= Math.max(20, s.yarn.totalGrams * 0.1)).slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title="안녕하세요 ☁️"
        subtitle="오늘도 한 코 한 코, 천천히."
      />

      <div className="grid grid-cols-3 gap-2">
        <QuickCard to="/projects/new" icon={Plus} label="새 프로젝트" tone="accent" />
        <QuickCard to="/library/yarns/new" icon={Layers} label="실 추가" />
        <QuickCard to="/library/patterns/new" icon={Scroll} label="도안 추가" />
      </div>

      <Section title="진행중인 프로젝트" to="/projects">
        {!inProgress?.length ? (
          <Empty text="아직 진행중인 프로젝트가 없어요." />
        ) : (
          <div className="space-y-2">
            {inProgress.slice(0, 3).map(p => (
              <Link key={p.id} to={`/projects/${p.id}`} className="card-soft block p-4 hover:border-primary/40 transition">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-ink">{p.name}</h3>
                  <span className={`chip ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                </div>
                {p.progressNote && <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{p.progressNote}</p>}
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="최근 수정" to="/projects">
        {!recent?.length ? (
          <Empty text="기록이 쌓이면 여기에 보여요." />
        ) : (
          <div className="space-y-1.5">
            {recent.map(p => (
              <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-secondary/60">
                <span className="text-sm text-ink">{p.name}</span>
                <span className="text-xs text-muted-foreground">{statusLabel(p.status)}</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="재고가 부족한 실" to="/library/yarns">
        {!lowStock.length ? (
          <Empty text="재고가 모두 넉넉합니다." />
        ) : (
          <div className="space-y-2">
            {lowStock.map(s => (
              <Link key={s.yarn.id} to={`/library/yarns/${s.yarn.id}`} className="card-soft flex items-center justify-between p-3.5">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <AlertTriangle className="h-3.5 w-3.5 text-accent" />
                    {s.yarn.name}
                  </div>
                  {s.yarn.brand && <div className="text-xs text-muted-foreground">{s.yarn.brand}</div>}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-accent">{s.remaining}g</div>
                  <div className="text-[11px] text-muted-foreground">/ {s.yarn.totalGrams}g</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <PrivacyNote />
    </div>
  );
}

function QuickCard({ to, icon: Icon, label, tone }: { to: string; icon: any; label: string; tone?: 'accent' }) {
  return (
    <Link
      to={to}
      className={`card-soft flex flex-col items-center justify-center gap-1.5 py-4 text-center transition hover:translate-y-[-1px] ${
        tone === 'accent' ? 'bg-gradient-warm' : ''
      }`}
    >
      <Icon className="h-5 w-5 text-primary" />
      <span className="text-xs font-medium text-ink">{label}</span>
    </Link>
  );
}

function Section({ title, to, children }: { title: string; to?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="font-serif text-lg font-semibold text-ink">{title}</h2>
        {to && (
          <Link to={to} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary">
            전체 <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl bg-secondary/50 px-4 py-6 text-center text-sm text-muted-foreground">{text}</div>;
}
