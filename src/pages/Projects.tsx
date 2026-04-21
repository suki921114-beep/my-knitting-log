import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ProjectStatus } from '@/lib/db';
import { statusLabel, statusColor } from '@/lib/yarnCalc';
import PageHeader from '@/components/PageHeader';
import { Plus, Search, Image as ImageIcon } from 'lucide-react';

const FILTERS: { v: 'all' | ProjectStatus; label: string }[] = [
  { v: 'all', label: '전체' },
  { v: 'in_progress', label: '진행중' },
  { v: 'planned', label: '예정' },
  { v: 'done', label: '완성' },
  { v: 'on_hold', label: '보류' },
];

const VALID: ProjectStatus[] = ['in_progress', 'planned', 'done', 'on_hold'];

export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get('status');
  const [filter, setFilter] = useState<'all' | ProjectStatus>(
    initial && VALID.includes(initial as ProjectStatus) ? (initial as ProjectStatus) : 'all'
  );
  const [q, setQ] = useState('');
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), []);

  useEffect(() => {
    const s = searchParams.get('status');
    if (s && VALID.includes(s as ProjectStatus)) setFilter(s as ProjectStatus);
    else if (!s) setFilter('all');
  }, [searchParams]);

  function handleFilter(v: 'all' | ProjectStatus) {
    setFilter(v);
    if (v === 'all') setSearchParams({});
    else setSearchParams({ status: v });
  }

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
        right={
          <Link to="/projects/new" className="btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" /> 새 프로젝트
          </Link>
        }
      />

      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="검색"
          className="input-pill"
        />
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
        {FILTERS.map(f => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`filter-chip ${filter === f.v ? 'filter-chip-on' : 'filter-chip-off'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card-soft mt-6 flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-[13px] text-muted-foreground">아직 프로젝트가 없어요</p>
          <Link to="/projects/new" className="btn-primary btn-sm">
            <Plus className="h-3.5 w-3.5" /> 첫 프로젝트
          </Link>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map(p => {
            const cover = p.photos?.[0];
            return (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="card-soft flex items-center gap-3 overflow-hidden p-2.5 hover:shadow-soft">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                    {cover ? (
                      <img src={cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-[14.5px] font-semibold text-foreground">{p.name}</h3>
                      <span className={`chip ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                    </div>
                    {(p.size || p.gauge) && (
                      <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                        {[p.size && `사이즈 ${p.size}`, p.gauge && `게이지 ${p.gauge}`].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {p.progressNote && <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{p.progressNote}</p>}
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
