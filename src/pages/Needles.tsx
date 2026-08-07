import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Needle } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { Plus, Search } from 'lucide-react';
import { EmptyState } from '@/components/Mascot';
import {
  NEEDLE_KINDS,
  NEEDLE_SUBTYPES,
  NEEDLE_TIPS,
  describeNeedle,
  needleKindOf,
  readNeedle,
  type NeedleKind,
} from '@/lib/needleType';

// ----------------------------------------------------------------------------
// 바늘 목록
// ----------------------------------------------------------------------------
// 조립식 세트를 넣으면 스무 줄이 넘는데, 줄마다 앞부분이 똑같다.
// '대바늘 · 조립식 · 숏팁 · 치아오구 · 스틸' 이 스무 번 반복되고 정작
// 다른 건 호수 하나뿐이다. 그래서 같은 것끼리 묶고 호수만 칩으로 늘어놓는다.

/** 앞부분이 같은 바늘끼리 묶는 열쇠 */
function groupKey(n: Needle): string {
  return [n.type, n.subType, n.tipLength, n.brand, n.material, n.length]
    .map(v => v || '')
    .join('|');
}

/** '4.0mm' 에서 4 를 뽑는다. 숫자가 없으면 맨 뒤로 보낸다. */
function sizeValue(raw?: string): number {
  const m = (raw || '').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : Number.POSITIVE_INFINITY;
}

const KIND_ORDER = new Map(NEEDLE_KINDS.map((k, i) => [k, i]));

export default function Needles() {
  const items = useLiveQuery(
    () => db.needles.filter(x => !x.isDeleted).toArray(),
    [],
  ) || [];
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<NeedleKind | 'all'>('all');
  const [sub, setSub] = useState<string | 'all'>('all');
  const [tip, setTip] = useState<string | 'all'>('all');

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
      if (kind !== 'all' && needleKindOf(n) !== kind) return false;
      const shape = readNeedle(n);
      if (sub !== 'all' && shape.subType !== sub) return false;
      if (tip !== 'all' && shape.tip !== tip) return false;
      if (!s) return true;
      return [describeNeedle(n), n.brand, n.material, n.sizeMm, n.length]
        .filter(Boolean)
        .some(v => v!.toLowerCase().includes(s));
    });
  }, [items, q, kind, sub, tip]);

  const groups = useMemo(() => {
    const m = new Map<string, Needle[]>();
    for (const n of filtered) {
      const k = groupKey(n);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(n);
    }
    return [...m.values()]
      .map(list => ({
        head: describeNeedle(list[0]),
        sub: [list[0].brand, list[0].material, list[0].length].filter(Boolean).join(' · '),
        // 호수는 숫자 순으로 — 2.0 다음에 2.25 가 와야 눈이 편하다
        items: [...list].sort((a, b) => sizeValue(a.sizeMm) - sizeValue(b.sizeMm)),
      }))
      .sort((a, b) => {
        const ka = KIND_ORDER.get(needleKindOf(a.items[0])) ?? 99;
        const kb = KIND_ORDER.get(needleKindOf(b.items[0])) ?? 99;
        return ka !== kb ? ka - kb : a.head.localeCompare(b.head, 'ko');
      });
  }, [filtered]);

  // 대바늘을 고른 뒤에만 세부 갈래를 물어본다. 코바늘에 '숏팁' 을 묻는 건 이상하다.
  const showSubFilters = kind === '대바늘';

  function pickKind(next: NeedleKind | 'all') {
    setKind(next);
    setSub('all');
    setTip('all');
  }

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
        <div className="mb-4 space-y-1.5">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
            <Chip active={kind === 'all'} onClick={() => pickKind('all')}>
              전체 {items.length}
            </Chip>
            {NEEDLE_KINDS.filter(k => counts.get(k)).map(k => (
              <Chip key={k} active={kind === k} onClick={() => pickKind(k)}>
                {k} {counts.get(k)}
              </Chip>
            ))}
          </div>

          {showSubFilters && (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
              {NEEDLE_SUBTYPES.map(s => (
                <Chip key={s} small active={sub === s} onClick={() => setSub(sub === s ? 'all' : s)}>
                  {s}
                </Chip>
              ))}
              <span className="w-1 shrink-0" />
              {NEEDLE_TIPS.map(t => (
                <Chip key={t} small active={tip === t} onClick={() => setTip(tip === t ? 'all' : t)}>
                  {t}
                </Chip>
              ))}
            </div>
          )}
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
      ) : groups.length === 0 ? (
        <p className="rounded-2xl bg-secondary/50 px-3 py-6 text-center text-[12px] text-muted-foreground">
          조건에 맞는 바늘이 없어요.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <section key={g.head + g.sub} className="card-soft p-3.5">
              <div className="mb-2.5">
                <div className="text-[13.5px] font-bold text-foreground">{g.head}</div>
                {g.sub && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{g.sub}</div>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map(n => (
                  <Link
                    key={n.id}
                    to={`/library/needles/${n.id}/edit`}
                    className="inline-flex items-center gap-1 rounded-xl border border-border bg-secondary/40 px-2.5 py-1.5 text-[13px] font-semibold tabular-nums text-foreground transition hover:border-primary/50 hover:bg-primary-soft/50 hover:text-primary"
                  >
                    {n.sizeMm || '호수 없음'}
                    {(n.quantity ?? 1) > 1 && (
                      <span className="text-[10.5px] font-bold text-primary">×{n.quantity}</span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  small = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border transition ${
        small ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      } ${
        active
          ? 'border-primary bg-primary/10 font-semibold text-primary'
          : 'border-border text-muted-foreground'
      }`}
    >
      {children}
    </button>
  );
}
