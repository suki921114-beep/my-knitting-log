import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import ViewToggle from '@/components/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { Plus, Search, Image as ImageIcon } from 'lucide-react';

export default function Notions() {
  const items = useLiveQuery(() => db.notions.orderBy('updatedAt').reverse().toArray(), []) || [];
  const [q, setQ] = useState('');
  const [view, setView] = useViewMode('notions', 'list');
  const filtered = items.filter(n => !q || [n.name, n.kind, n.shop].filter(Boolean).some(v => v!.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader title="부자재" back right={
        <Link to="/library/notions/new" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-soft">
          <Plus className="h-3.5 w-3.5" /> 추가
        </Link>
      } />
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="부자재 검색"
          className="w-full rounded-full border bg-card py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary" />
      </div>
      <div className="mb-4 flex justify-end">
        <ViewToggle value={view} onChange={setView} />
      </div>
      {filtered.length === 0 ? (
        <p className="card-soft p-8 text-center text-sm text-muted-foreground">아직 등록된 부자재가 없습니다.</p>
      ) : view === 'list' ? (
        <ul className="space-y-2">
          {filtered.map(n => (
            <li key={n.id}>
              <Link to={`/library/notions/${n.id}/edit`} className="card-soft flex items-center gap-3 p-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
                  {n.photoDataUrl ? (
                    <img src={n.photoDataUrl} alt={n.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-4 w-4" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">{n.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{n.kind} {n.shop && `· ${n.shop}`}</div>
                </div>
                {typeof n.quantity === 'number' && <div className="text-sm font-semibold text-primary">{n.quantity}</div>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-3 gap-3">
          {filtered.map(n => (
            <li key={n.id}>
              <Link to={`/library/notions/${n.id}/edit`} className="card-soft block overflow-hidden">
                <div className="aspect-square bg-muted">
                  {n.photoDataUrl ? (
                    <img src={n.photoDataUrl} alt={n.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-5 w-5" /></div>
                  )}
                </div>
                <div className="p-2">
                  <div className="truncate text-xs font-medium text-ink">{n.name}</div>
                  {typeof n.quantity === 'number' && <div className="text-[11px] text-muted-foreground">{n.quantity}개</div>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
