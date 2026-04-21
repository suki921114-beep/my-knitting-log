import { useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { db, exportAll, importAll, clearAll } from '@/lib/db';
import { Download, Upload, Trash2, ShieldCheck, ChevronRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

export default function Settings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    setLastBackup(localStorage.getItem('lastBackupAt'));
  }, []);

  const totals = useLiveQuery(async () => ({
    p: await db.projects.count(),
    y: await db.yarns.count(),
    pat: await db.patterns.count(),
    n: await db.needles.count(),
    no: await db.notions.count(),
  }), []) || { p: 0, y: 0, pat: 0, n: 0, no: 0 };

  const totalItems = totals.p + totals.y + totals.pat + totals.n + totals.no;

  async function handleExport() {
    setBusy(true);
    try {
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const d = new Date().toISOString().slice(0, 10);
      a.download = `knit-backup-${d}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const now = new Date().toISOString();
      localStorage.setItem('lastBackupAt', now);
      setLastBackup(now);
    } finally {
      setBusy(false);
    }
  }
  async function handleImport(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!confirm('가져온 데이터를 현재 데이터에 병합할까요?')) return;
      await importAll(data);
      alert('가져오기 완료');
    } catch (e: any) {
      alert('가져오기 실패: ' + e.message);
    } finally {
      setBusy(false);
    }
  }
  async function handleClear() {
    if (!confirm('정말 모든 데이터를 삭제할까요?')) return;
    if (!confirm('되돌릴 수 없습니다. 계속할까요?')) return;
    await clearAll();
    alert('삭제 완료');
  }

  const lastBackupLabel = lastBackup
    ? new Date(lastBackup).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
    : '없음';

  return (
    <div className="space-y-6">
      <PageHeader title="설정" />

      <div className="card-soft p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <ShieldCheck className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-foreground">로컬 저장</div>
            <p className="text-[11.5px] text-muted-foreground">이 기기에만 저장됨</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
          <Meta label="저장된 항목" value={`${totalItems}개`} />
          <Meta label="마지막 백업" value={lastBackupLabel} />
        </div>
      </div>

      <Section title="백업">
        <button
          onClick={handleExport}
          disabled={busy}
          className="card-soft flex w-full items-center gap-3 p-4 transition active:scale-[0.99] hover:shadow-soft disabled:opacity-60"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Download className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[13.5px] font-semibold text-foreground">내보내기</div>
            <div className="text-[11.5px] text-muted-foreground">JSON 파일로 저장</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="card-soft flex w-full items-center gap-3 p-4 transition active:scale-[0.99] hover:shadow-soft disabled:opacity-60"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent-foreground">
            <Upload className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[13.5px] font-semibold text-foreground">가져오기</div>
            <div className="text-[11.5px] text-muted-foreground">JSON 파일 선택</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />
      </Section>

      <Section title="위험 영역">
        <button
          onClick={handleClear}
          className="card-soft flex w-full items-center gap-3 border-destructive/30 bg-destructive/5 p-4 transition active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <Trash2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[13.5px] font-semibold text-destructive">전체 삭제</div>
            <div className="text-[11.5px] text-destructive/70">되돌릴 수 없음</div>
          </div>
        </button>
      </Section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold text-foreground">{value}</div>
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

