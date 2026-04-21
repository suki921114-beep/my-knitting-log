import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ProjectStatus } from '@/lib/db';
import { statusLabel, statusColor } from '@/lib/yarnCalc';
import PageHeader from '@/components/PageHeader';
import { Plus, Search } from 'lucide-react';

const FILTERS: { v: 'all' | ProjectStatus; label: string }[] = [
  { v: 'all', label: '전체' },
  { v: 'in_progress', label: '진행중' },
  { v: 'planned', label: '예정' },
  { v: 'done', label: '완성' },
  { v: 'on_hold', label: '보류' },
];

export default function Projects() {
  const [filter, setFilter] = useState<'all' | ProjectStatus>('all');
  const [q, setQ] = useState('');
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), []);

  const filtered = useMemo(() => {
    if (!projects) return [];
    return projects
      .filter(p => filter === 'all' || p.status === filter)
      .filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  }, [projects, filter, q]);

  return (
    <div>
      <PageHeader
        title="프로젝트"
        subtitle="진행중인 작업을 한눈에 확인하세요."
        right={
          <Link to="/projects/new" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-soft">
            <Plus className="h-4 w-4" /> 새 프로젝트
          </Link>
        }
      />

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="프로젝트 검색"
          className="w-full rounded-full border bg-card py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              filter === f.v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card-soft mt-6 p-10 text-center">
          <p className="text-sm text-muted-foreground">아직 등록된 프로젝트가 없어요.</p>
          <Link to="/projects/new" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
            <Plus className="h-4 w-4" /> 첫 프로젝트 시작하기
          </Link>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map(p => (
            <li key={p.id}>
              <Link to={`/projects/${p.id}`} className="card-soft block p-4 transition hover:border-primary/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-ink">{p.name}</h3>
                    {(p.size || p.gauge) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.size && <>사이즈 {p.size}</>}
                        {p.size && p.gauge && ' · '}
                        {p.gauge && <>게이지 {p.gauge}</>}
                      </p>
                    )}
                    {p.progressNote && <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{p.progressNote}</p>}
                  </div>
                  <span className={`chip shrink-0 ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
