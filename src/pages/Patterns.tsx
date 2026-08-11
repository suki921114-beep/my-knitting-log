import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { gaugeSearchText } from '@/lib/gauge';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import ViewToggle from '@/components/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { Plus, Search, Image as ImageIcon, FileText } from 'lucide-react';
import { EmptyState } from '@/components/Mascot';

export default function Patterns() {
  const items = useLiveQuery(() => db.patterns.orderBy('updatedAt').reverse().filter(x => !x.isDeleted).toArray(), []) || [];
  // PDF 가 붙은 도안에 표시를 단다.
  // ⚠️ 파일 자체는 절대 읽지 않는다 — 목록 한 번 그리는 데 수십 MB 를 읽게 된다.
  //    색인(patternId) 값만 가져오면 크기가 붙지 않는다.
  const withFile = useLiveQuery(
    async () => new Set((await db.patternFiles.orderBy('patternId').keys()) as number[]),
    [],
  ) || new Set<number>();
  const [q, setQ] = useState('');
  const [view, setView] = useViewMode('patterns', 'grid');
  // 게이지로도 찾을 수 있어야 한다 — '4.0mm' 나 '22코' 를 치면 그 게이지를
  // 요구하는 도안이 나온다. 가진 실에 맞는 도안을 고를 때 쓰는 흐름이다.
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(p =>
      [p.name, p.designer, p.source, p.sizeInfo, p.difficulty]
        .filter(Boolean)
        .some(v => v!.toLowerCase().includes(s)) || gaugeSearchText(p.gauges).includes(s),
    );
  }, [items, q]);

  return (
    <div>
      <PageHeader title="도안" back right={
        <Link to="/library/patterns/new" className="btn-primary btn-sm">
          <Plus className="h-3.5 w-3.5" /> 추가
        </Link>
      } />
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="검색 · 게이지로도 찾아요 (4.0mm, 22코)"
          className="input-pill"
        />
      </div>
      <div className="mb-4 flex justify-end">
        <ViewToggle value={view} onChange={setView} />
      </div>
      {filtered.length === 0 ? (
        <div className="card-soft">
          <EmptyState title="아직 등록된 도안이 없어요" sub="사둔 도안을 모아 두면 프로젝트에 바로 연결할 수 있어요." mood="sleepy" />
        </div>
      ) : view === 'list' ? (
        <ul className="space-y-2">
          {filtered.map(p => (
            <li key={p.id}>
              <Link to={`/library/patterns/${p.id}/edit`} className="card-soft flex items-center gap-3 p-2.5 hover:shadow-soft">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl">
                  {p.imageDataUrl ? (
                    <img src={p.imageDataUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="img-placeholder"><ImageIcon className="h-4 w-4" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-semibold text-foreground">{p.name}</span>
                    {withFile.has(p.id!) && <FileText className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="PDF 있음" />}
                  </div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {[p.designer, p.difficulty, p.sizeInfo].filter(Boolean).join(' · ') || '—'}
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
                <div className="relative aspect-[4/5] overflow-hidden">
                  {p.imageDataUrl ? (
                    <img src={p.imageDataUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="img-placeholder"><ImageIcon className="h-6 w-6" /></div>
                  )}
                  {withFile.has(p.id!) && (
                    <span
                      className="absolute right-1.5 top-1.5 rounded-full bg-card/90 p-1 shadow-soft"
                      aria-label="PDF 있음"
                    >
                      <FileText className="h-3.5 w-3.5 text-primary" />
                    </span>
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
