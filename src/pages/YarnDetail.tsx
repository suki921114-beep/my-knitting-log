import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useYarnRemaining, gramsToMeters, formatMeters, yarnRecommendations } from '@/lib/yarnCalc';
import { formatNeedleSize } from '@/lib/needleType';
import PageHeader from '@/components/PageHeader';
import { Pencil, ExternalLink, Scale, Ruler, CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

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

  async function toggleUsedUp() {
    if (!yarn) return;
    const next = !yarn.usedUp;
    await db.yarns.update(yid, { usedUp: next, updatedAt: Date.now() } as any);
    toast.success(next ? '다 쓴 실로 표시했어요' : '아직 남은 실로 되돌렸어요');
  }

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

      {/* 잔여량과 실 정보를 한 카드에 좌우로. 총량·사용량은 막대 바로 아래 오른쪽에
          두어, 막대가 가리키는 숫자를 바로 옆에서 읽게 한다. */}
      <div className="card-soft bg-primary-soft p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
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

          {(yarn.fiber || yarn.weight || yarn.shop || yarn.link) && (
            <div className="space-y-0.5 text-[12.5px] text-primary/85 sm:max-w-[260px] sm:text-right">
              {yarn.fiber && <div className="truncate"><span className="text-primary/55">성분 </span>{yarn.fiber}</div>}
              {yarn.weight && <div className="truncate"><span className="text-primary/55">굵기 </span>{yarn.weight}</div>}
              {yarn.shop && <div className="truncate"><span className="text-primary/55">구매처 </span>{yarn.shop}</div>}
              {yarn.link && (
                <a
                  href={normalizeUrl(yarn.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex max-w-full items-center gap-1 font-semibold text-primary underline underline-offset-2"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">구매 링크 열기</span>
                </a>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-card/60">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>

        {/* 잔량은 계산으로 나오지만 실제로는 딱 떨어지지 않는다.
            자투리를 버렸거나 g 을 대충 적었을 때 사람이 끝났다고 말할 수 있게 한다. */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={toggleUsedUp}
            className="inline-flex items-center gap-1.5 rounded-full bg-card/70 px-3 py-1.5 text-[11.5px] font-semibold text-primary transition hover:bg-card"
          >
            {yarn.usedUp ? (
              <><RotateCcw className="h-3.5 w-3.5" /> 아직 남았어요</>
            ) : (
              <><CheckCircle2 className="h-3.5 w-3.5" /> 다 썼어요</>
            )}
          </button>

          <div className="flex flex-col items-end gap-0.5 text-[11.5px] font-medium tabular-nums text-primary/80">
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 shrink-0" aria-label="무게" />
              <span>{remaining}g<span className="mx-1 opacity-50">|</span>{total}g</span>
            </div>
            {remainingMeters !== null && totalMeters !== null && (
              <div className="flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5 shrink-0" aria-label="길이" />
                <span>{formatMeters(remainingMeters)}<span className="mx-1 opacity-50">|</span>{formatMeters(totalMeters)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

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

      {/* 게이지 정보는 실을 고른 뒤에 보는 값이라 사용 기록 다음에 둔다 */}
      {recs.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">게이지 정보</h2>
          <div className="space-y-2">
            {recs.map(r => (
              <div key={r.strands} className="card-soft flex items-center gap-3 p-3.5">
                <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-[11.5px] font-bold text-primary">
                  {r.strands}합
                </span>
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-medium text-muted-foreground">바늘</div>
                    <div className="truncate text-[13px] font-semibold text-ink">{formatNeedleSize(r.needleSize) || '—'}</div>
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

      {yarn.note && (
        <div className="card-soft whitespace-pre-wrap p-4 text-sm text-ink">{yarn.note}</div>
      )}
    </div>
  );
}
