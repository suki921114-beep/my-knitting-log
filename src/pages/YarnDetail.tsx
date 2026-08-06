import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useYarnRemaining, gramsToMeters, formatMeters, yarnRecommendations } from '@/lib/yarnCalc';
import PageHeader from '@/components/PageHeader';
import { Pencil, ExternalLink } from 'lucide-react';

/** 스킴이 없으면 https:// 를 붙여 준다 (예: "shop.com/x" → "https://shop.com/x") */
function normalizeUrl(raw: string): string {
  const s = raw.trim();
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export default function YarnDetail() {
  const { id } = useParams();
  const yid = Number(id);
  const yarn = useLiveQuery(() => db.yarns.get(yid), [yid]);
  const stats = useYarnRemaining(yid);
  const links = useLiveQuery(() => db.projectYarns.where('yarnId').equals(yid).toArray(), [yid]) || [];
  const projects = useLiveQuery(() => db.projects.filter(p => !p.isDeleted).toArray(), []) || [];
  const pmap = new Map(projects.map(p => [p.id!, p]));

  if (!yarn) return <p className="p-8 text-center text-sm text-muted-foreground">불러오는 중…</p>;
  if (yarn.isDeleted) {
    return (
      <div className="space-y-3">
        <PageHeader title="삭제된 실" back />
        <p className="card-soft p-8 text-center text-sm text-muted-foreground">
          이 실은 삭제된 상태입니다. 라이브러리에서는 보이지 않아요.
        </p>
      </div>
    );
  }

  const total = stats?.total ?? yarn.totalGrams;
  const used = stats?.used ?? 0;
  const remaining = stats?.remaining ?? yarn.totalGrams;
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  // 100g당 길이를 적어둔 실만 길이로도 보여준다
  const totalMeters = gramsToMeters(total, yarn.metersPer100g);
  const remainingMeters = gramsToMeters(remaining, yarn.metersPer100g);
  const recs = yarnRecommendations(yarn);

  return (
    <div className="space-y-5">
      <PageHeader
        title={yarn.name}
        back
        subtitle={[yarn.brand, yarn.colorName, yarn.colorCode && `(${yarn.colorCode})`].filter(Boolean).join(' · ')}
        right={
          <Link to={`/library/yarns/${yid}/edit`} className="btn-soft btn-sm">
            <Pencil className="h-3.5 w-3.5" /> 수정
          </Link>
        }
      />

      {/* 무게와 길이는 같은 것을 두 가지 단위로 말하는 것이라 붙여 둔다.
          떨어뜨려 놓으면 눈이 위아래를 오가야 해서 읽기 어렵다. */}
      <div className="card-soft bg-primary-soft p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary/80">잔여량</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-[32px] font-extrabold leading-none tracking-tight text-primary">
                {remaining}<span className="ml-1 text-base font-medium text-primary/70">g</span>
              </span>
              {remainingMeters !== null && (
                <span className="text-[15px] font-bold leading-none text-primary/75">
                  약 {formatMeters(remainingMeters)}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right text-[11.5px] text-primary/80">
            <div>총 {total}g{totalMeters !== null && ` · ${formatMeters(totalMeters)}`}</div>
            <div>사용 {used}g</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-card/60">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {(yarn.fiber || yarn.weight || yarn.shop || yarn.link) && (
        <div className="card-soft space-y-0.5 p-4 text-sm">
          {yarn.fiber && <div><span className="text-muted-foreground">성분 </span>{yarn.fiber}</div>}
          {yarn.weight && <div><span className="text-muted-foreground">굵기 </span>{yarn.weight}</div>}
          {yarn.shop && <div><span className="text-muted-foreground">구매처 </span>{yarn.shop}</div>}
          {yarn.link && (
            <a
              href={normalizeUrl(yarn.link)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex max-w-full items-center gap-1 text-primary underline underline-offset-2"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">구매 링크 열기</span>
            </a>
          )}
        </div>
      )}

      {recs.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">권장 사양</h2>
          <div className="space-y-2">
            {recs.map(r => (
              <div key={r.strands} className="card-soft flex items-center gap-3 p-3.5">
                <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-[11.5px] font-bold text-primary">
                  {r.strands}합
                </span>
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-medium text-muted-foreground">바늘</div>
                    <div className="truncate text-[13px] font-semibold text-ink">{r.needleSize || '—'}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-medium text-muted-foreground">게이지</div>
                    <div className="truncate text-[13px] font-semibold text-ink">{r.gauge || '—'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-title">사용된 프로젝트</h2>
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
