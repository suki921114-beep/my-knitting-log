import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAllYarnStats, gramsToMeters, formatMeters, isUsedUp, YARN_DYE_TYPES } from '@/lib/yarnCalc';
import PageHeader from '@/components/PageHeader';
import ViewToggle from '@/components/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { Plus, Search, ArrowUpDown, Check, Image as ImageIcon } from 'lucide-react';
import { EmptyState } from '@/components/Mascot';

type Sort = 'updated' | 'low' | 'high' | 'lowM' | 'highM';

const HIDE_USED_UP_KEY = 'yarnsHideUsedUp';

const SORT_LABEL: Record<Sort, string> = {
  updated: '최근 순',
  low: '재고 적은 순',
  high: '재고 많은 순',
  lowM: '길이 짧은 순',
  highM: '길이 긴 순',
};

/**
 * 길이순 정렬용 값.
 *
 * 100g당 길이를 안 적어둔 실은 길이를 알 수 없다. 0 으로 치면 "가장 짧은 실"로
 * 올라와 버리니, 어느 방향으로 정렬하든 맨 뒤로 보낸다.
 */
function lengthKey(m: number | null, desc: boolean): number {
  if (m === null) return desc ? -Infinity : Infinity;
  return m;
}

export default function Yarns() {
  const stats = useAllYarnStats() || [];
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [brand, setBrand] = useState<string>('all');
  const [dyeType, setDyeType] = useState<string>('all');
  const [view, setView] = useViewMode('yarns', 'grid');
  // 다 쓴 실은 대개 다시 볼 일이 없다. 기본으로 감추되 선택은 기억한다.
  const [hideUsedUp, setHideUsedUp] = useState(
    () => localStorage.getItem(HIDE_USED_UP_KEY) !== 'false',
  );

  function toggleHideUsedUp() {
    const next = !hideUsedUp;
    setHideUsedUp(next);
    localStorage.setItem(HIDE_USED_UP_KEY, String(next));
  }

  const usedUpCount = useMemo(
    () => stats.filter(s => isUsedUp(s.yarn, s.remaining)).length,
    [stats],
  );

  // 아무도 종류를 안 적어뒀으면 거를 것도 없다
  const hasDyeType = useMemo(() => stats.some(s => !!s.yarn.dyeType), [stats]);

  const brands = useMemo(
    () => Array.from(new Set(stats.map(s => s.yarn.brand).filter(Boolean))) as string[],
    [stats]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let arr = stats.filter(x =>
      (!s || [x.yarn.name, x.yarn.brand, x.yarn.colorName, x.yarn.fiber, x.yarn.weight].filter(Boolean).some(v => v!.toLowerCase().includes(s))) &&
      (brand === 'all' || x.yarn.brand === brand) &&
      (dyeType === 'all' || x.yarn.dyeType === dyeType) &&
      (!hideUsedUp || !isUsedUp(x.yarn, x.remaining))
    );
    if (sort === 'updated') arr = arr.sort((a, b) => b.yarn.updatedAt - a.yarn.updatedAt);
    if (sort === 'low') arr = arr.sort((a, b) => a.remaining - b.remaining);
    if (sort === 'high') arr = arr.sort((a, b) => b.remaining - a.remaining);
    if (sort === 'lowM' || sort === 'highM') {
      const desc = sort === 'highM';
      arr = arr.sort((a, b) => {
        const am = lengthKey(gramsToMeters(a.remaining, a.yarn.metersPer100g), desc);
        const bm = lengthKey(gramsToMeters(b.remaining, b.yarn.metersPer100g), desc);
        return desc ? bm - am : am - bm;
      });
    }
    return arr;
  }, [stats, q, sort, brand, dyeType, hideUsedUp]);

  return (
    <div>
      <PageHeader
        title="실"
        back
        right={
          <Link to="/library/yarns/new" className="btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" /> 추가
          </Link>
        }
      />

      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="검색" className="input-pill" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <select value={brand} onChange={e => setBrand(e.target.value)} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">
          <option value="all">전체 브랜드</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {/* 염색실만 모아 보고 합사할 실을 고르는 흐름. 염색실 브랜드가 많아
            브랜드로 찾기는 어렵다는 의견에서 나왔다. */}
        {hasDyeType && (
          <select
            value={dyeType}
            onChange={e => setDyeType(e.target.value)}
            aria-label="실 종류"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            <option value="all">전체 종류</option>
            {YARN_DYE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {/* 정렬 기준이 다섯 가지가 되어 눌러 넘기는 방식으로는 원하는 걸 찾기 어렵다 */}
        <div className="relative inline-flex items-center">
          <ArrowUpDown className="pointer-events-none absolute left-3 h-3 w-3 text-foreground" />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as Sort)}
            aria-label="정렬 기준"
            className="appearance-none rounded-full border border-border bg-card py-1.5 pl-7 pr-3 text-xs font-semibold text-foreground"
          >
            {(Object.keys(SORT_LABEL) as Sort[]).map(k => (
              <option key={k} value={k}>{SORT_LABEL[k]}</option>
            ))}
          </select>
        </div>
        {usedUpCount > 0 && (
          <button
            type="button"
            onClick={toggleHideUsedUp}
            aria-pressed={hideUsedUp}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              hideUsedUp
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground'
            }`}
          >
            <span className={`flex h-3 w-3 items-center justify-center rounded-[4px] border ${
              hideUsedUp ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50'
            }`}>
              {hideUsedUp && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
            </span>
            다 쓴 실 숨기기
          </button>
        )}
        <div className="ml-auto"><ViewToggle value={view} onChange={setView} /></div>
      </div>

      {filtered.length === 0 ? (
        <div className="card-soft">
          <EmptyState title="아직 등록된 실이 없어요" sub="가지고 있는 실을 등록해 두면 잔량이 자동으로 계산돼요." mood="sleepy" />
        </div>
      ) : view === 'list' ? (
        <ul className="space-y-2">
          {filtered.map(s => {
            const pct = s.yarn.totalGrams > 0 ? Math.max(0, Math.min(100, (s.remaining / s.yarn.totalGrams) * 100)) : 0;
            return (
              <li key={s.yarn.id}>
                <Link to={`/library/yarns/${s.yarn.id}`} className="card-soft flex items-center gap-3 p-2.5 hover:shadow-soft">
                  <Thumb src={s.yarn.photoDataUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-foreground">{s.yarn.name}</div>
                        <div className="truncate text-[11.5px] text-muted-foreground">
                          {[s.yarn.brand, s.yarn.colorName, s.yarn.weight].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[14px] font-bold text-primary">{s.remaining}<span className="ml-0.5 text-[10.5px] font-normal text-muted-foreground">/{s.yarn.totalGrams}g</span></div>
                        <LengthLine remaining={s.remaining} total={s.yarn.totalGrams} per100g={s.yarn.metersPer100g} />
                      </div>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map(s => {
            const pct = s.yarn.totalGrams > 0 ? Math.max(0, Math.min(100, (s.remaining / s.yarn.totalGrams) * 100)) : 0;
            return (
              <li key={s.yarn.id}>
                <Link to={`/library/yarns/${s.yarn.id}`} className="card-soft block overflow-hidden hover:shadow-soft">
                  <div className="aspect-square overflow-hidden">
                    {s.yarn.photoDataUrl ? (
                      <img src={s.yarn.photoDataUrl} alt={s.yarn.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="img-placeholder"><ImageIcon className="h-6 w-6" /></div>
                    )}
                  </div>
                  <div className="space-y-1.5 p-2.5">
                    <div className="truncate text-[13px] font-semibold text-foreground">{s.yarn.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{s.yarn.brand || '—'}</div>
                    <div className="h-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[11px] font-bold text-primary tabular-nums">{s.remaining}<span className="font-normal text-muted-foreground">/{s.yarn.totalGrams}g</span></div>
                    <LengthLine remaining={s.remaining} total={s.yarn.totalGrams} per100g={s.yarn.metersPer100g} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * 무게 아래에 길이를 한 줄 덧붙인다.
 * 100g당 길이를 안 적어둔 실은 알 수 없으니 아예 내보내지 않는다.
 */
function LengthLine({ remaining, total, per100g }: { remaining: number; total: number; per100g?: number }) {
  const rm = gramsToMeters(remaining, per100g);
  const tm = gramsToMeters(total, per100g);
  if (rm === null || tm === null) return null;
  return (
    <div className="text-[10.5px] font-medium tabular-nums text-muted-foreground">
      {formatMeters(rm)}<span className="opacity-70">/{formatMeters(tm)}</span>
    </div>
  );
}

function Thumb({ src }: { src?: string }) {
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="img-placeholder"><ImageIcon className="h-4 w-4" /></div>
      )}
    </div>
  );
}
