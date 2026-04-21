import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import ViewToggle from '@/components/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { Plus, Search, Image as ImageIcon } from 'lucide-react';

export default function Patterns() {
  const items = useLiveQuery(() => db.patterns.orderBy('updatedAt').reverse().toArray(), []) || [];
  const [q, setQ] = useState('');
  const [view, setView] = useViewMode('patterns', 'grid');
  const filtered = items.filter(p => !q || [p.name, p.designer, p.source].filter(Boolean).some(v => v!.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader title="도안" back right={
        <Link to="/library/patterns/new" className="btn-primary btn-sm">
          <Plus className="h-3.5 w-3.5" /> 추가
        </Link>
      } />
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="검색" className="input-pill" />
      </div>
      <div className="mb-4 flex justify-end">
        <ViewToggle value={view} onChange={setView} />
      </div>
      {filtered.length === 0 ? (
        <p className="card-soft p-8 text-center text-sm text-muted-foreground">아직 등록된 도안이 없어요</p>
      ) : view === 'list' ? (
        <ul className="space-y-2">
          {filtered.map(p => (
            <li key={p.id}>
              <Link to={`/library/patterns/${p.id}/edit`} className="card-soft flex items-center gap-3 p-2.5 hover:shadow-soft">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  {p.imageDataUrl ? (
                    <img src={p.imageDataUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-4 w-4" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-foreground">{p.name}</div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {[p.designer, p.difficulty, p.sizeInfo].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map(p => (
            <li key={p.id}>
              <Link to={`/library/patterns/${p.id}/edit`} className="card-soft block overflow-hidden hover:shadow-soft">
                <div className="aspect-[4/5] bg-secondary">
                  {p.imageDataUrl ? (
                    <img src={p.imageDataUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-6 w-6" /></div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="truncate text-[13px] font-semibold text-foreground">{p.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{p.designer || '—'}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
