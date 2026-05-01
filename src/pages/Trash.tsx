import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { toast } from '@/components/ui/sonner';
import { RotateCcw, Trash2, Inbox } from 'lucide-react';

// ----------------------------------------------------------------------------
// 휴지통 — soft delete 된 모든 entity 를 한 곳에서 보고 복원/영구삭제
// ----------------------------------------------------------------------------
// 복원: isDeleted=false 로 update → 자동 백업 → 다른 기기에서도 복원
// 영구 삭제: 로컬 hard delete (db.X.delete). 클라우드 묘비(isDeleted=true) 는
//          그대로 남아 다른 기기 가져오기 시 부활 방지. 클라우드 문서까지 삭제
//          하려면 별도 단계 필요 (다음 작업).

type TableName = 'yarns' | 'patterns' | 'needles' | 'notions' | 'projects' | 'rowCounters' | 'projectGauges';

export default function Trash() {
  const yarns = useLiveQuery(() => db.yarns.filter(y => y.isDeleted === true).toArray(), []) || [];
  const patterns = useLiveQuery(() => db.patterns.filter(p => p.isDeleted === true).toArray(), []) || [];
  const needles = useLiveQuery(() => db.needles.filter(n => n.isDeleted === true).toArray(), []) || [];
  const notions = useLiveQuery(() => db.notions.filter(n => n.isDeleted === true).toArray(), []) || [];
  const projects = useLiveQuery(() => db.projects.filter(p => p.isDeleted === true).toArray(), []) || [];
  const rowCounters = useLiveQuery(() => db.rowCounters.filter(c => c.isDeleted === true).toArray(), []) || [];
  const projectGauges = useLiveQuery(() => db.projectGauges.filter(g => g.isDeleted === true).toArray(), []) || [];

  // sub-entity 의 소속 프로젝트 표시용 (삭제된 프로젝트 포함 전체)
  const allProjects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const projectMap = new Map(allProjects.map(p => [p.id!, p]));

  const total =
    yarns.length + patterns.length + needles.length + notions.length +
    projects.length + rowCounters.length + projectGauges.length;

  async function restore(table: TableName, id: number, label: string) {
    const t = Date.now();
    await (db as any)[table].update(id, {
      isDeleted: false,
      deletedAt: null,
      updatedAt: t,
    });
    toast.success(`${label}을(를) 복원했어요`);
  }

  async function purge(table: TableName, id: number, label: string) {
    if (!confirm(`"${label}"을(를) 영구 삭제할까요? 되돌릴 수 없어요.`)) return;
    await (db as any)[table].delete(id);
    toast.success('영구 삭제했어요', {
      description: '이 기기에서 완전히 지웠습니다.',
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader title="휴지통" back subtitle={total > 0 ? `${total}개 항목` : '비어있음'} />

      {total === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Inbox className="h-6 w-6" />
          </span>
          <p className="text-[13px] text-muted-foreground">휴지통이 비어있어요</p>
        </div>
      ) : (
        <>
          <Section
            title="실"
            items={yarns}
            getName={(y) => y.name}
            getMeta={(y) => [y.brand, y.colorName].filter(Boolean).join(' · ')}
            tableName="yarns"
            onRestore={restore}
            onPurge={purge}
          />
          <Section
            title="도안"
            items={patterns}
            getName={(p) => p.name}
            getMeta={(p) => [p.designer, p.difficulty].filter(Boolean).join(' · ')}
            tableName="patterns"
            onRestore={restore}
            onPurge={purge}
          />
          <Section
            title="바늘"
            items={needles}
            getName={(n) => `${n.type}${n.sizeMm ? ' · ' + n.sizeMm : ''}`}
            getMeta={(n) => [n.brand, n.material].filter(Boolean).join(' · ')}
            tableName="needles"
            onRestore={restore}
            onPurge={purge}
          />
          <Section
            title="부자재"
            items={notions}
            getName={(n) => n.name}
            getMeta={(n) => [n.kind, n.shop].filter(Boolean).join(' · ')}
            tableName="notions"
            onRestore={restore}
            onPurge={purge}
          />
          <Section
            title="프로젝트"
            items={projects}
            getName={(p) => p.name}
            getMeta={(p) => p.status === 'in_progress' ? '진행중' : p.status === 'planned' ? '예정' : p.status === 'done' ? '완성' : '보류'}
            tableName="projects"
            onRestore={restore}
            onPurge={purge}
          />
          <Section
            title="단수 카운터"
            items={rowCounters}
            getName={(c) => c.name}
            getMeta={(c) => {
              const p = projectMap.get(c.projectId);
              const projectName = p?.name || '(삭제된 프로젝트)';
              return `${projectName} · ${c.count}단`;
            }}
            tableName="rowCounters"
            onRestore={restore}
            onPurge={purge}
          />
          <Section
            title="게이지 계산"
            items={projectGauges}
            getName={(g) => g.name}
            getMeta={(g) => {
              const p = projectMap.get(g.projectId);
              const projectName = p?.name || '(삭제된 프로젝트)';
              const result = g.resultStitches > 0 || g.resultRows > 0
                ? ` · ${g.resultStitches > 0 ? g.resultStitches + '코' : ''}${g.resultStitches > 0 && g.resultRows > 0 ? ' ' : ''}${g.resultRows > 0 ? g.resultRows + '단' : ''}`
                : '';
              return `${projectName}${result}`;
            }}
            tableName="projectGauges"
            onRestore={restore}
            onPurge={purge}
          />
        </>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        ※ <strong>복원</strong>: 다음 자동 백업으로 다른 기기에도 다시 보입니다.<br />
        ※ <strong>영구 삭제</strong>: 이 기기에서 완전히 지웁니다. 클라우드의 삭제 기록은 그대로 남아 다른 기기에서도 부활하지 않아요.
      </p>
    </div>
  );
}

function Section<T extends { id?: number; deletedAt?: number | null }>({
  title,
  items,
  getName,
  getMeta,
  tableName,
  onRestore,
  onPurge,
}: {
  title: string;
  items: T[];
  getName: (it: T) => string;
  getMeta: (it: T) => string;
  tableName: TableName;
  onRestore: (table: TableName, id: number, label: string) => Promise<void>;
  onPurge: (table: TableName, id: number, label: string) => Promise<void>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="section-title">{title} · {items.length}</h2>
      <ul className="space-y-2">
        {items.map((it) => {
          const name = getName(it);
          const meta = getMeta(it);
          const at = it.deletedAt
            ? new Date(it.deletedAt).toLocaleString('ko-KR', {
                month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })
            : '';
          return (
            <li key={it.id} className="card-soft p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-foreground">{name}</div>
                  {meta && <div className="truncate text-[11.5px] text-muted-foreground">{meta}</div>}
                  {at && <div className="mt-0.5 text-[10.5px] text-muted-foreground tabular-nums">삭제: {at}</div>}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onRestore(tableName, it.id!, name)}
                    className="flex items-center gap-1 rounded-lg bg-primary-soft px-2.5 py-1.5 text-[11.5px] font-semibold text-primary hover:bg-primary-soft/80"
                  >
                    <RotateCcw className="h-3 w-3" />
                    복원
                  </button>
                  <button
                    type="button"
                    onClick={() => onPurge(tableName, it.id!, name)}
                    className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-destructive hover:bg-destructive/15"
                  >
                    <Trash2 className="h-3 w-3" />
                    영구 삭제
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
