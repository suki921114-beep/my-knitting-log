import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useYarnRemaining } from '@/lib/yarnCalc';
import PageHeader from '@/components/PageHeader';
import { Pencil } from 'lucide-react';

export default function YarnDetail() {
  const { id } = useParams();
  const yid = Number(id);
  const yarn = useLiveQuery(() => db.yarns.get(yid), [yid]);
  const stats = useYarnRemaining(yid);
  const links = useLiveQuery(() => db.projectYarns.where('yarnId').equals(yid).toArray(), [yid]) || [];
  const projects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const pmap = new Map(projects.map(p => [p.id!, p]));

  if (!yarn) return <p className="p-8 text-center text-sm text-muted-foreground">불러오는 중…</p>;

  const total = stats?.total ?? yarn.totalGrams;
  const used = stats?.used ?? 0;
  const remaining = stats?.remaining ?? yarn.totalGrams;
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={yarn.name}
        back
        subtitle={[yarn.brand, yarn.colorName, yarn.colorCode && `(${yarn.colorCode})`].filter(Boolean).join(' · ')}
        right={
          <Link to={`/library/yarns/${yid}/edit`} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">
            <Pencil className="inline h-3.5 w-3.5" /> 수정
          </Link>
        }
      />

      <div className="card-soft bg-gradient-card p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs text-muted-foreground">잔여량</div>
            <div className="font-serif text-3xl font-semibold text-primary">{remaining}<span className="ml-1 text-base font-normal text-muted-foreground">g</span></div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>총 {total}g</div>
            <div>사용 {used}g</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {(yarn.fiber || yarn.weight || yarn.shop) && (
        <div className="card-soft p-4 text-sm">
          {yarn.fiber && <div><span className="text-muted-foreground">성분 </span>{yarn.fiber}</div>}
          {yarn.weight && <div><span className="text-muted-foreground">굵기 </span>{yarn.weight}</div>}
          {yarn.shop && <div><span className="text-muted-foreground">구매처 </span>{yarn.shop}</div>}
        </div>
      )}

      <section>
        <h2 className="mb-2 px-1 font-serif text-base font-semibold text-ink">사용된 프로젝트</h2>
        {links.length === 0 ? (
          <p className="rounded-xl bg-secondary/50 px-3 py-4 text-center text-xs text-muted-foreground">아직 사용 기록이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {links.map(l => {
              const p = pmap.get(l.projectId);
              return (
                <li key={l.id}>
                  <Link to={`/projects/${l.projectId}`} className="card-soft flex items-center justify-between p-3">
                    <span className="text-sm text-ink">{p?.name || '프로젝트'}</span>
                    <span className="text-sm font-medium text-accent">{l.usedGrams}g</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {yarn.note && (
        <div className="card-soft whitespace-pre-wrap p-4 text-sm text-ink">{yarn.note}</div>
      )}
    </div>
  );
}
