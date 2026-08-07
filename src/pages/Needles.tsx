import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { Plus, Search } from 'lucide-react';
import { EmptyState } from '@/components/Mascot';
import { NeedlesIcon } from '@/components/CraftIcons';
import { NEEDLE_KINDS, describeNeedle, needleKindOf, type NeedleKind } from '@/lib/needleType';

type Filter = NeedleKind | 'all';

export default function Needles() {
  const items = useLiveQuery(
    () => db.needles.orderBy('updatedAt').reverse().filter(x => !x.isDeleted).toArray(),
    [],
  ) || [];
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // 갈래별 개수 — 하나도 없는 갈래는 칩을 내보내지 않는다
  const counts = useMemo(() => {
    const m = new Map<NeedleKind, number>();
    for (const n of items) {
      const k = needleKindOf(n);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(n => {
      if (filter !== 'all' && needleKindOf(n) !== filter) return false;
      if (!s) return true;
      return [describeNeedle(n), n.brand, n.material, n.sizeMm, n.length]
        .filter(Boolean)
        .some(v => v!.toLowerCase().includes(s));
    });
  }, [items, q, filter]);

  return (
    <div>
      <PageHeader
        title="바늘"
        back
        right={
          <Link to="/library/needles/new" className="btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" /> 추가
          </Link>
        }
      />

      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="검색" className="input-pill" />
      </div>

      {items.length > 0 && (
        <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
            전체 {items.length}
          </Chip>
          {NEEDLE_KINDS.filter(k => counts.get(k)).map(k => (
            <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
              {k} {counts.get(k)}
            </Chip>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card-soft">
          <EmptyState
            title="아직 등록된 바늘이 없어요"
            sub="가진 바늘을 적어 두면 같은 호수를 또 사는 일이 줄어요."
            mood="sleepy"
          />
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl bg-secondary/50 px-3 py-6 text-center text-[12px] text-muted-foreground">
          조건에 맞는 바늘이 없어요.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map(n => (
            <li key={n.id}>
              <Link
                to={`/library/needles/${n.id}/edit`}
                className="card-soft flex items-center gap-3 p-3.5 hover:shadow-soft"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <NeedlesIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-foreground">
                    {describeNeedle(n)}{n.sizeMm && ` · ${n.sizeMm}`}
                  </div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {[n.brand, n.material, n.length].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? 'border-primary bg-primary/10 font-semibold text-primary'
          : 'border-border text-muted-foreground'
      }`}
    >
      {children}
    </button>
  );
}
