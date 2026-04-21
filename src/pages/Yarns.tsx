import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAllYarnStats } from '@/lib/yarnCalc';
import PageHeader from '@/components/PageHeader';
import ViewToggle from '@/components/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { Plus, Search, ArrowUpDown, Image as ImageIcon } from 'lucide-react';

type Sort = 'updated' | 'low' | 'high';

export default function Yarns() {
  const stats = useAllYarnStats() || [];
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [brand, setBrand] = useState<string>('all');
  const [view, setView] = useViewMode('yarns', 'list');

  const brands = useMemo(
    () => Array.from(new Set(stats.map(s => s.yarn.brand).filter(Boolean))) as string[],
    [stats]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let arr = stats.filter(x =>
      (!s || [x.yarn.name, x.yarn.brand, x.yarn.colorName, x.yarn.fiber, x.yarn.weight].filter(Boolean).some(v => v!.toLowerCase().includes(s))) &&
      (brand === 'all' || x.yarn.brand === brand)
    );
    if (sort === 'updated') arr = arr.sort((a, b) => b.yarn.updatedAt - a.yarn.updatedAt);
    if (sort === 'low') arr = arr.sort((a, b) => a.remaining - b.remaining);
    if (sort === 'high') arr = arr.sort((a, b) => b.remaining - a.remaining);
    return arr;
  }, [stats, q, sort, brand]);

  return (
    <div>
      <PageHeader
        title="실"
        back
        subtitle="총 보유량과 잔여량은 자동 계산됩니다."
        right={
          <Link to="/library/yarns/new" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-soft">
            <Plus className="h-3.5 w-3.5" /> 추가
          </Link>
        }
      />

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="실 검색"
          className="w-full rounded-full border bg-card py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <select value={brand} onChange={e => setBrand(e.target.value)} className="rounded-full border bg-card px-3 py-1.5 text-xs">
          <option value="all">전체 브랜드</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <button onClick={() => setSort(sort === 'low' ? 'high' : sort === 'high' ? 'updated' : 'low')}
          className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-xs">
          <ArrowUpDown className="h-3 w-3" />
          {sort === 'updated' ? '최근 수정' : sort === 'low' ? '재고 적은 순' : '재고 많은 순'}
        </button>
        <div className="ml-auto"><ViewToggle value={view} onChange={setView} /></div>
      </div>

      {filtered.length === 0 ? (
        <p className="card-soft p-8 text-center text-sm text-muted-foreground">아직 등록된 실이 없습니다.</p>
      ) : view === 'list' ? (
        <ul className="space-y-2">
          {filtered.map(s => {
            const pct = s.yarn.totalGrams > 0 ? Math.max(0, Math.min(100, (s.remaining / s.yarn.totalGrams) * 100)) : 0;
            return (
              <li key={s.yarn.id}>
                <Link to={`/library/yarns/${s.yarn.id}`} className="card-soft flex items-center gap-3 p-3">
                  <Thumb src={s.yarn.photoDataUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">{s.yarn.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {s.yarn.brand} {s.yarn.colorName && `· ${s.yarn.colorName}`} {s.yarn.weight && `· ${s.yarn.weight}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-primary">{s.remaining}g</div>
                        <div className="text-[11px] text-muted-foreground">/ {s.yarn.totalGrams}g</div>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
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
          {filtered.map(s => (
            <li key={s.yarn.id}>
              <Link to={`/library/yarns/${s.yarn.id}`} className="card-soft block overflow-hidden">
                <div className="aspect-square bg-muted">
                  {s.yarn.photoDataUrl ? (
                    <img src={s.yarn.photoDataUrl} alt={s.yarn.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="truncate text-sm font-medium text-ink">{s.yarn.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{s.yarn.brand}</div>
                  <div className="mt-1 text-xs font-semibold text-primary">{s.remaining}<span className="font-normal text-muted-foreground">/{s.yarn.totalGrams}g</span></div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thumb({ src }: { src?: string }) {
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
