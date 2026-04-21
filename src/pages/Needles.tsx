import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { Plus, Search } from 'lucide-react';

export default function Needles() {
  const items = useLiveQuery(() => db.needles.orderBy('updatedAt').reverse().toArray(), []) || [];
  const [q, setQ] = useState('');
  const filtered = items.filter(n => !q || [n.type, n.brand, n.material, n.sizeMm].filter(Boolean).some(v => v!.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader title="바늘" back right={
        <Link to="/library/needles/new" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-soft">
          <Plus className="h-3.5 w-3.5" /> 추가
        </Link>
      } />
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="바늘 검색"
          className="w-full rounded-full border bg-card py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary" />
      </div>
      {filtered.length === 0 ? (
        <p className="card-soft p-8 text-center text-sm text-muted-foreground">아직 등록된 바늘이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map(n => (
            <li key={n.id}>
              <Link to={`/library/needles/${n.id}/edit`} className="card-soft flex items-center justify-between p-3.5">
                <div>
                  <div className="font-medium text-ink">{n.type} {n.sizeMm && `· ${n.sizeMm}`}</div>
                  <div className="text-xs text-muted-foreground">
                    {n.brand} {n.material && `· ${n.material}`} {n.length && `· ${n.length}`}
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
