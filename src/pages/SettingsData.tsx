import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { db, clearAll } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, ChevronRight, ShieldCheck } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function SettingsData() {
  const navigate = useNavigate();
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0);
  const [clearing, setClearing] = useState(false);

  // 7개 entity 합산 카운트
  const trashCount = useLiveQuery(async () => {
    const [y, p, n, no, pr, rc, pg] = await Promise.all([
      db.yarns.filter(x => x.isDeleted === true).count(),
      db.patterns.filter(x => x.isDeleted === true).count(),
      db.needles.filter(x => x.isDeleted === true).count(),
      db.notions.filter(x => x.isDeleted === true).count(),
      db.projects.filter(x => x.isDeleted === true).count(),
      db.rowCounters.filter(x => x.isDeleted === true).count(),
      db.projectGauges.filter(x => x.isDeleted === true).count(),
    ]);
    return y + p + n + no + pr + rc + pg;
  }, []) ?? 0;

  // 활성 데이터 카운트
  const totals = useLiveQuery(async () => ({
    p: await db.projects.filter(x => !x.isDeleted).count(),
    y: await db.yarns.filter(x => !x.isDeleted).count(),
    pat: await db.patterns.filter(x => !x.isDeleted).count(),
    n: await db.needles.filter(x => !x.isDeleted).count(),
    no: await db.notions.filter(x => !x.isDeleted).count(),
  }), []) || { p: 0, y: 0, pat: 0, n: 0, no: 0 };

  const totalItems = totals.p + totals.y + totals.pat + totals.n + totals.no;

  async function runClear() {
    setClearing(true);
    try {
      await clearAll();
      toast.success('전체 데이터가 삭제되었습니다');
    } catch (e) {
      console.error('[SettingsData] 전체 삭제 실패:', e);
      toast.error('전체 삭제 실패', {
        description: '잠시 후 다시 시도해 주세요.',
      });
    } finally {
      setClearing(false);
      setClearStep(0);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="데이터 관리" back />

      {/* 데이터 요약 */}
      <div className="card-soft p-4 bg-card">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-foreground">로컬 저장</div>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
              현재 모든 기록은 이 기기에 안전하게 보관 중입니다.
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
          <Meta label="저장된 항목" value={`${totalItems}개`} />
          <Meta label="휴지통" value={trashCount > 0 ? `${trashCount}개` : '비어 있음'} />
        </dl>
      </div>

      {/* 휴지통 */}
      <Section title="휴지통">
        <button
          onClick={() => navigate('/settings/trash')}
          className="card-soft flex w-full items-center gap-3 p-4 transition active:scale-[0.99] hover:shadow-soft bg-card"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Trash2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[13.5px] font-semibold text-foreground">삭제된 항목</div>
            <div className="text-[11.5px] text-muted-foreground">복원하거나 영구 삭제할 수 있어요</div>
          </div>
          {trashCount > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10.5px] font-bold text-amber-700 dark:text-amber-400 tabular-nums">
              {trashCount}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </Section>

      {/* 위험 영역 */}
      <Section title="위험 영역">
        <button
          onClick={() => setClearStep(1)}
          disabled={clearing}
          className="card-danger flex w-full items-center gap-3 p-4 text-left bg-card disabled:opacity-50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Trash2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-destructive">전체 삭제</div>
            <div className="text-[11.5px] text-destructive/70">이 기기의 모든 데이터를 지웁니다 · 되돌릴 수 없어요</div>
          </div>
          <ChevronRight className="h-4 w-4 text-destructive/50" />
        </button>
      </Section>

      {/* 1단계: 전체 데이터 삭제 의사 확인 */}
      <ConfirmDialog
        open={clearStep === 1}
        onOpenChange={(o) => !o && setClearStep(0)}
        title="모든 데이터를 삭제할까요?"
        description={
          <span>
            이 기기의 프로젝트 {totals.p}개, 실 {totals.y}개, 도안 {totals.pat}개, 바늘 {totals.n}개, 부자재 {totals.no}개와 휴지통 항목 {trashCount}개가 모두 사라집니다.
            {' '}연결된 클라우드 백업은 영향을 받지 않아요.
          </span>
        }
        confirmLabel="다음"
        cancelLabel="취소"
        destructive
        onConfirm={() => setClearStep(2)}
      />

      {/* 2단계: 되돌릴 수 없음을 다시 한 번 환기 */}
      <ConfirmDialog
        open={clearStep === 2}
        onOpenChange={(o) => !o && setClearStep(0)}
        title="되돌릴 수 없어요. 계속할까요?"
        description="삭제하면 휴지통에서도 복원할 수 없습니다. 클라우드 백업이 있다면 [가져오기] 로 다시 받아올 수 있어요."
        confirmLabel="전체 삭제"
        cancelLabel="취소"
        destructive
        busy={clearing}
        onConfirm={runClear}
      />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-[14px] font-bold tracking-tight text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="section-title">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
