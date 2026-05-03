import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { Plus, Search, Ruler } from 'lucide-react';

export default function Needles() {
  const items = useLiveQuery(() => db.needles.orderBy('updatedAt').reverse().filter(x => !x.isDeleted).toArray(), []) || [];
  const [q, setQ] = useState('');
  const filtered = items.filter(n => !q || [n.type, n.brand, n.material, n.sizeMm].filter(Boolean).some(v => v!.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader title="바늘" back right={
        <Link to="/library/needles/new" className="btn-primary btn-sm">
          <Plus className="h-3.5 w-3.5" /> 추가
        </Link>
      } />
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="검색" className="input-pill" />
      </div>
      {filtered.length === 0 ? (
        <p className="card-soft p-8 text-center text-sm text-muted-foreground">아직 등록된 바늘이 없어요</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map(n => (
            <li key={n.id}>
              <Link to={`/library/needles/${n.id}/edit`} className="card-soft flex items-center gap-3 p-3.5 hover:shadow-soft">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Ruler className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-foreground">{n.type}{n.sizeMm && ` · ${n.sizeMm}`}</div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {[n.brand, n.material, n.length].filter(Boolean).join(' · ')}
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
