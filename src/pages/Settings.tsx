import { useRef, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import PrivacyNote from '@/components/PrivacyNote';
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
      if (!confirm('가져온 데이터를 현재 데이터에 병합할까요? (같은 ID는 덮어씌워집니다)')) return;
      await importAll(data);
      alert('가져오기 완료!');
    } catch (e: any) {
      alert('가져오기 실패: ' + e.message);
    } finally {
      setBusy(false);
    }
  }
  async function handleClear() {
    if (!confirm('정말 모든 데이터를 삭제할까요? 이 동작은 되돌릴 수 없습니다.')) return;
    if (!confirm('한 번 더 확인합니다. 모든 프로젝트와 라이브러리가 삭제됩니다. 계속할까요?')) return;
    await clearAll();
    alert('모든 데이터를 삭제했습니다.');
  }

  return (
    <div className="space-y-5">
      <PageHeader title="설정" subtitle="데이터는 이 기기에만 저장됩니다." />

      <div className="card-soft space-y-3 bg-gradient-card p-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-sage" />
          <div className="text-sm text-ink">
            <div className="font-medium">개인정보 최소수집</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              이 앱은 이메일·전화번호 등 직접 식별정보를 요구하지 않는 구조로 설계됩니다.
              데이터는 로컬에만 저장되며, 외부로 전송되지 않습니다.
            </p>
          </div>
        </div>
      </div>

      <Section title="백업 / 복원">
        <button onClick={handleExport} disabled={busy} className="card-soft flex w-full items-center justify-between p-4">
          <div className="flex items-center gap-3"><Download className="h-5 w-5 text-primary" /><span className="text-sm font-medium">JSON으로 내보내기</span></div>
          <span className="text-xs text-muted-foreground">파일 저장</span>
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="card-soft flex w-full items-center justify-between p-4">
          <div className="flex items-center gap-3"><Upload className="h-5 w-5 text-primary" /><span className="text-sm font-medium">백업 가져오기</span></div>
          <span className="text-xs text-muted-foreground">JSON 선택</span>
        </button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />
      </Section>

      <Section title="위험 영역">
        <button onClick={handleClear} className="card-soft flex w-full items-center justify-between border-destructive/20 p-4">
          <div className="flex items-center gap-3"><Trash2 className="h-5 w-5 text-destructive" /><span className="text-sm font-medium text-destructive">전체 데이터 삭제</span></div>
        </button>
      </Section>

      <PrivacyNote kind="memo" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 font-serif text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
