// ----------------------------------------------------------------------------
// 라이브러리 통합 검색
// ----------------------------------------------------------------------------
// 실·도안·바늘·부자재를 한 번에 찾는다.
//
// 왜 필요한가. "치아오구" 를 찾을 때 그게 바늘인지 실인지 기억나지 않는다.
// 게이지도 마찬가지다 — '4.0mm 22코' 로 찾으면 그 게이지가 나오는 실과
// 그 게이지를 요구하는 도안이 같이 나와야 짝을 지을 수 있다.
//
// 아무것도 안 치면 아무것도 안 보인다. 빈 검색으로 전부 늘어놓으면
// 그냥 네 목록을 한 화면에 부어 놓은 것과 다를 게 없다.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, X, Image as ImageIcon } from 'lucide-react';
import { db } from '@/lib/db';
import { gaugeSearchText } from '@/lib/gauge';
import { yarnRecommendations } from '@/lib/yarnCalc';
import { describeNeedle, formatNeedleSize } from '@/lib/needleType';

interface Hit {
  key: string;
  to: string;
  kind: '실' | '도안' | '바늘' | '부자재';
  title: string;
  sub: string;
  thumb?: string;
}

/** 한 종류에서 몇 개까지 보여줄지 — 넘치면 목록으로 가는 게 낫다 */
const PER_KIND = 6;

const KIND_STYLE: Record<Hit['kind'], string> = {
  실: 'bg-primary-soft text-primary',
  도안: 'bg-accent-soft text-accent-foreground',
  바늘: 'bg-primary-soft text-primary',
  부자재: 'bg-accent-soft text-accent-foreground',
};

export default function LibrarySearch() {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();

  const data = useLiveQuery(async () => {
    if (!term) return null;
    const [yarns, patterns, needles, notions] = await Promise.all([
      db.yarns.filter(x => !x.isDeleted).toArray(),
      db.patterns.filter(x => !x.isDeleted).toArray(),
      db.needles.filter(x => !x.isDeleted).toArray(),
      db.notions.filter(x => !x.isDeleted).toArray(),
    ]);
    return { yarns, patterns, needles, notions };
  }, [term]);

  const hits = useMemo<Hit[]>(() => {
    if (!term || !data) return [];
    const has = (...vals: (string | undefined | null)[]) =>
      vals.filter(Boolean).some(v => v!.toLowerCase().includes(term));

    const out: Hit[] = [];

    for (const y of data.yarns) {
      if (!has(y.name, y.brand, y.colorName, y.fiber, y.weight, y.plySpec, y.dyeType) &&
          !gaugeSearchText(yarnRecommendations(y)).includes(term)) continue;
      out.push({
        key: `y${y.id}`,
        to: `/library/yarns/${y.id}`,
        kind: '실',
        title: y.name,
        sub: [y.brand, y.colorName, y.weight].filter(Boolean).join(' · ') || '—',
        thumb: y.photoDataUrl,
      });
    }

    for (const p of data.patterns) {
      if (!has(p.name, p.designer, p.source, p.sizeInfo, p.difficulty) &&
          !gaugeSearchText(p.gauges).includes(term)) continue;
      out.push({
        key: `p${p.id}`,
        to: `/library/patterns/${p.id}/edit`,
        kind: '도안',
        title: p.name,
        sub: [p.designer, p.sizeInfo].filter(Boolean).join(' · ') || '—',
        thumb: p.imageDataUrl,
      });
    }

    for (const n of data.needles) {
      if (!has(n.type, n.subType, n.tipLength, n.brand, n.material, n.sizeMm, n.length)) continue;
      out.push({
        key: `n${n.id}`,
        to: `/library/needles/${n.id}/edit`,
        kind: '바늘',
        title: `${describeNeedle(n)}${n.sizeMm ? ` · ${formatNeedleSize(n.sizeMm)}` : ''}`,
        sub: [n.brand, n.material, n.length].filter(Boolean).join(' · ') || '—',
      });
    }

    for (const n of data.notions) {
      if (!has(n.name, n.kind, n.shop)) continue;
      out.push({
        key: `o${n.id}`,
        to: `/library/notions/${n.id}/edit`,
        kind: '부자재',
        title: n.name,
        sub: [n.kind, n.shop].filter(Boolean).join(' · ') || '—',
        thumb: n.photoDataUrl,
      });
    }

    return out;
  }, [term, data]);

  const groups = useMemo(() => {
    const order: Hit['kind'][] = ['실', '도안', '바늘', '부자재'];
    return order
      .map(kind => ({ kind, items: hits.filter(h => h.kind === kind) }))
      .filter(g => g.items.length > 0);
  }, [hits]);

  return (
    <div className="mb-4">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="실 · 도안 · 바늘 · 부자재 한 번에 찾기"
          className="input-pill pr-10"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="지우기"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {term && (
        <div className="mt-3 space-y-3">
          {groups.length === 0 ? (
            <p className="rounded-2xl bg-secondary/50 px-3 py-6 text-center text-[12.5px] text-muted-foreground">
              찾는 게 없어요.
              <br />
              <span className="text-[11.5px]">게이지로도 찾을 수 있어요 — 4.0mm, 22코</span>
            </p>
          ) : (
            groups.map(g => (
              <section key={g.kind}>
                <div className="mb-1.5 flex items-baseline gap-1.5">
                  <h3 className="text-[12px] font-bold text-foreground">{g.kind}</h3>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{g.items.length}</span>
                </div>
                <ul className="space-y-1.5">
                  {g.items.slice(0, PER_KIND).map(h => (
                    <li key={h.key}>
                      <Link to={h.to} className="card-soft flex items-center gap-2.5 p-2 hover:shadow-soft">
                        <Thumb src={h.thumb} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold text-foreground">{h.title}</div>
                          <div className="truncate text-[11px] text-muted-foreground">{h.sub}</div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${KIND_STYLE[h.kind]}`}>
                          {h.kind}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {g.items.length > PER_KIND && (
                  <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                    외 {g.items.length - PER_KIND}개 — {g.kind} 목록에서 더 볼 수 있어요
                  </p>
                )}
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Thumb({ src }: { src?: string }) {
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="img-placeholder"><ImageIcon className="h-3.5 w-3.5" /></div>
      )}
    </div>
  );
}
