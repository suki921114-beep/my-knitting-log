import { useRef, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { exportAll, importAll, clearAll } from '@/lib/db';
import { Download, Upload, Trash2, ShieldCheck } from 'lucide-react';

export default function Settings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="space-y-6">
      <PageHeader title="설정" />

      <div className="card-soft flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <div className="text-[13.5px] font-semibold text-foreground">로컬 저장</div>
          <p className="text-[11.5px] text-muted-foreground">데이터는 이 기기에만 저장됩니다.</p>
        </div>
      </div>

      <Section title="백업">
        <button onClick={handleExport} disabled={busy} className="card-soft flex w-full items-center justify-between p-4 hover:shadow-soft">
          <div className="flex items-center gap-3">
            <Download className="h-4 w-4 text-primary" />
            <span className="text-[13.5px] font-semibold text-foreground">내보내기</span>
          </div>
          <span className="text-[11px] text-muted-foreground">JSON</span>
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="card-soft flex w-full items-center justify-between p-4 hover:shadow-soft">
          <div className="flex items-center gap-3">
            <Upload className="h-4 w-4 text-primary" />
            <span className="text-[13.5px] font-semibold text-foreground">가져오기</span>
          </div>
          <span className="text-[11px] text-muted-foreground">JSON 선택</span>
        </button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />
      </Section>

      <Section title="위험">
        <button onClick={handleClear} className="card-soft flex w-full items-center justify-between border-destructive/20 p-4">
          <div className="flex items-center gap-3">
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="text-[13.5px] font-semibold text-destructive">전체 삭제</span>
          </div>
        </button>
      </Section>
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
