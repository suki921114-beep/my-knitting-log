import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { purgeFromCloud } from '@/lib/sync/purge';
import { purgeExpiredTrash, trashDaysLeft, TRASH_RETENTION_DAYS } from '@/lib/autoPurge';
import PageHeader from '@/components/PageHeader';
import { toast } from '@/components/ui/sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RotateCcw, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/Mascot';

// ----------------------------------------------------------------------------
// 휴지통 — soft delete 된 모든 entity 를 한 곳에서 보고 복원/영구삭제
// ----------------------------------------------------------------------------
// 복원: isDeleted=false 로 update. [백업] 을 누르면 다른 기기에서도 복원된다.
// 영구 삭제: 기기에서 hard delete + 클라우드 문서/사진까지 함께 삭제.
//          부활 방지는 sync/fetchRules 가 담당한다 (묘비를 남기지 않는다).

type TableName = 'yarns' | 'patterns' | 'needles' | 'notions' | 'projects' | 'rowCounters' | 'projectGauges' | 'logs';

export default function Trash() {
  // 휴지통을 열 때마다 보관 기간이 지난 항목을 먼저 정리한다
  useEffect(() => {
    purgeExpiredTrash().catch(e => console.error('[Trash] 자동 영구삭제 실패:', e));
  }, []);

  const yarns = useLiveQuery(() => db.yarns.filter(y => y.isDeleted === true).toArray(), []) || [];
  const patterns = useLiveQuery(() => db.patterns.filter(p => p.isDeleted === true).toArray(), []) || [];
  const needles = useLiveQuery(() => db.needles.filter(n => n.isDeleted === true).toArray(), []) || [];
  const notions = useLiveQuery(() => db.notions.filter(n => n.isDeleted === true).toArray(), []) || [];
  const projects = useLiveQuery(() => db.projects.filter(p => p.isDeleted === true).toArray(), []) || [];
  const rowCounters = useLiveQuery(() => db.rowCounters.filter(c => c.isDeleted === true).toArray(), []) || [];
  const projectGauges = useLiveQuery(() => db.projectGauges.filter(g => g.isDeleted === true).toArray(), []) || [];
  const logs = useLiveQuery(() => db.logs.filter(l => l.isDeleted === true).toArray(), []) || [];

  // sub-entity 의 소속 프로젝트 표시용 (삭제된 프로젝트 포함 전체)
  const allProjects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const projectMap = new Map(allProjects.map(p => [p.id!, p]));

  const total =
    yarns.length + patterns.length + needles.length + notions.length +
    projects.length + rowCounters.length + projectGauges.length + logs.length;

  // AlertDialog 로 가로채기 위한 pending state — 누른 항목을 임시 보관
  const [pendingPurge, setPendingPurge] = useState<{
    table: TableName;
    id: number;
    label: string;
  } | null>(null);
  const [purging, setPurging] = useState(false);
  // 전체 비우기 — 하나씩 지우기엔 번거로우므로 2단계 확인 후 한 번에
  const [emptyStep, setEmptyStep] = useState<0 | 1 | 2>(0);
  const [emptying, setEmptying] = useState(false);

  /** 휴지통에 있는 모든 항목을 이 기기에서 완전히 지운다 */
  async function emptyTrash() {
    setEmptying(true);
    try {
      const tables: TableName[] = [
        'yarns', 'patterns', 'needles', 'notions',
        'projects', 'rowCounters', 'projectGauges', 'logs',
      ];
      let removed = 0;
      for (const name of tables) {
        const table = (db as any)[name];
        // isDeleted 가 true 인 것만 — 실수로 살아있는 기록을 지우지 않도록 방어
        const rows = (await table.filter((x: any) => x.isDeleted === true).toArray())
          .filter((x: any) => typeof x.id === 'number');
        if (rows.length) {
          await purgeFromCloud(rows.map((x: any) => ({ table: name, cloudId: x.cloudId })));
          await table.bulkDelete(rows.map((x: any) => x.id));
          removed += rows.length;
        }
      }
      toast.success(`${removed}개를 영구 삭제했어요`, {
        id: 'trash-action',
        description: '기기와 클라우드에서 완전히 지웠습니다.',
      });
    } catch (e) {
      console.error('[Trash] 전체 비우기 실패:', e);
      toast.error('전체 비우기 실패', { id: 'trash-action', description: '잠시 후 다시 시도해 주세요.' });
    } finally {
      setEmptying(false);
      setEmptyStep(0);
    }
  }

  async function restore(table: TableName, id: number, label: string) {
    const t = Date.now();
    await (db as any)[table].update(id, {
      isDeleted: false,
      deletedAt: null,
      updatedAt: t,
    });
    toast.success(`${label}을(를) 복원했어요`, { id: 'trash-action' });
  }

  function askPurge(table: TableName, id: number, label: string) {
    setPendingPurge({ table, id, label });
  }

  async function runPurge() {
    if (!pendingPurge) return;
    setPurging(true);
    try {
      const table = (db as any)[pendingPurge.table];
      // 클라우드 삭제에 cloudId 가 필요하므로 로컬에서 지우기 전에 읽는다
      const row = await table.get(pendingPurge.id);
      await purgeFromCloud([{ table: pendingPurge.table, cloudId: row?.cloudId }]);
      await table.delete(pendingPurge.id);
      toast.success('영구 삭제했어요', {
        id: 'trash-action',
        description: '기기와 클라우드에서 완전히 지웠습니다.',
      });
    } catch (e) {
      console.error('[Trash] 영구 삭제 실패:', e);
      toast.error('영구 삭제 실패', {
        id: 'trash-action',
        description: '잠시 후 다시 시도해 주세요.',
      });
    } finally {
      setPurging(false);
      setPendingPurge(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="휴지통" back subtitle={total > 0 ? `${total}개 항목` : '비어있음'} />

      {total > 0 && (
        <div className="rounded-xl border border-warm/40 bg-warm/10 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink">
          삭제 후 <strong>{TRASH_RETENTION_DAYS}일</strong>이 지나면 기기와 클라우드에서 자동으로 완전히 삭제됩니다.
          되살리려면 그 전에 복원해 주세요.
        </div>
      )}

      {total > 0 && (
        <button
          type="button"
          onClick={() => setEmptyStep(1)}
          disabled={emptying}
          className="card-danger flex w-full items-center gap-3 p-3.5 text-left bg-card disabled:opacity-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Trash2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-destructive">휴지통 비우기</div>
            <div className="text-[11px] text-destructive/70">{total}개를 한 번에 영구 삭제해요</div>
          </div>
        </button>
      )}

      {total === 0 ? (
        <div className="card-soft">
          <EmptyState title="휴지통이 비어있어요" sub="지운 항목은 7일 동안 여기 머물러요." mood="happy" />
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
            onPurge={askPurge}
          />
          <Section
            title="도안"
            items={patterns}
            getName={(p) => p.name}
            getMeta={(p) => [p.designer, p.difficulty].filter(Boolean).join(' · ')}
            tableName="patterns"
            onRestore={restore}
            onPurge={askPurge}
          />
          <Section
            title="바늘"
            items={needles}
            getName={(n) => `${n.type}${n.sizeMm ? ' · ' + n.sizeMm : ''}`}
            getMeta={(n) => [n.brand, n.material].filter(Boolean).join(' · ')}
            tableName="needles"
            onRestore={restore}
            onPurge={askPurge}
          />
          <Section
            title="부자재"
            items={notions}
            getName={(n) => n.name}
            getMeta={(n) => [n.kind, n.shop].filter(Boolean).join(' · ')}
            tableName="notions"
            onRestore={restore}
            onPurge={askPurge}
          />
          <Section
            title="프로젝트"
            items={projects}
            getName={(p) => p.name}
            getMeta={(p) => p.status === 'in_progress' ? '진행중' : p.status === 'planned' ? '예정' : p.status === 'done' ? '완성' : '보류'}
            tableName="projects"
            onRestore={restore}
            onPurge={askPurge}
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
            onPurge={askPurge}
          />
          <Section
            title="뜨개 기록"
            items={logs}
            getName={(l) => (l.text.length > 24 ? l.text.slice(0, 24) + '…' : l.text) || '기록'}
            getMeta={(l) => {
              const p = l.projectId ? projectMap.get(l.projectId) : undefined;
              return [l.date, p?.name].filter(Boolean).join(' · ');
            }}
            tableName="logs"
            onRestore={restore}
            onPurge={askPurge}
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
            onPurge={askPurge}
          />
        </>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        ※ <strong>자동 정리</strong>: 삭제 후 {TRASH_RETENTION_DAYS}일이 지난 항목은 기기와 클라우드에서 자동으로 완전히 삭제됩니다.<br />
        ※ <strong>복원</strong>: 되살린 뒤 [백업] 을 누르면 다른 기기에서도 다시 보입니다.<br />
        ※ <strong>영구 삭제</strong>: 기기와 클라우드에서 완전히 지웁니다. 되돌릴 수 없어요.
      </p>

      <ConfirmDialog
        open={pendingPurge !== null}
        onOpenChange={(o) => !o && setPendingPurge(null)}
        title={pendingPurge ? `"${pendingPurge.label}" 을(를) 영구 삭제할까요?` : ''}
        description="기기와 클라우드에서 완전히 사라지고 복원할 수 없어요."
        confirmLabel="영구 삭제"
        cancelLabel="취소"
        destructive
        busy={purging}
        onConfirm={runPurge}
      />

      {/* 전체 비우기 1단계 */}
      <ConfirmDialog
        open={emptyStep === 1}
        onOpenChange={(o) => !o && setEmptyStep(0)}
        title="휴지통을 비울까요?"
        description={`휴지통에 있는 ${total}개 항목을 기기와 클라우드에서 완전히 지웁니다. 휴지통에 없는 기록은 그대로 남아요.`}
        confirmLabel="다음"
        cancelLabel="취소"
        destructive
        closeOnConfirm={false}
        onConfirm={() => setEmptyStep(2)}
      />

      {/* 전체 비우기 2단계 */}
      <ConfirmDialog
        open={emptyStep === 2}
        onOpenChange={(o) => !o && setEmptyStep(0)}
        title="되돌릴 수 없어요. 계속할까요?"
        description="지운 뒤에는 복원할 수 없습니다. 클라우드에 올려 둔 사진도 함께 지워집니다."
        confirmLabel="휴지통 비우기"
        cancelLabel="취소"
        destructive
        busy={emptying}
        onConfirm={emptyTrash}
      />
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
  onPurge: (table: TableName, id: number, label: string) => void;
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
          const left = trashDaysLeft(it.deletedAt);
          return (
            <li key={it.id} className="card-soft p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-foreground">{name}</div>
                  {meta && <div className="truncate text-[11.5px] text-muted-foreground">{meta}</div>}
                  {at && <div className="mt-0.5 text-[10.5px] text-muted-foreground tabular-nums">삭제: {at}</div>}
                  {left !== null && (
                    <div
                      className={`mt-0.5 text-[10.5px] tabular-nums ${
                        left <= 1 ? 'font-semibold text-destructive' : 'text-muted-foreground'
                      }`}
                    >
                      {left === 0 ? '오늘 자동 영구삭제' : `${left}일 후 자동 영구삭제`}
                    </div>
                  )}
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
