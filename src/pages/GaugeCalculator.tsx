import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { Save, X } from 'lucide-react';

export default function GaugeCalculator() {
  const projects = useLiveQuery(
    () => db.projects.orderBy('updatedAt').reverse().toArray(),
    []
  ) || [];

  const [patternSt, setPatternSt] = useState('');
  const [patternRows, setPatternRows] = useState('');
  const [mySt, setMySt] = useState('');
  const [myRows, setMyRows] = useState('');
  const [targetSt, setTargetSt] = useState('');
  const [targetRows, setTargetRows] = useState('');

  const [savePickerOpen, setSavePickerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const num = (v: string) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

  const pSt = num(patternSt), pRows = num(patternRows);
  const mSt = num(mySt), mRows = num(myRows);
  const tSt = num(targetSt), tRows = num(targetRows);

  const adjStitches = pSt > 0 && mSt > 0 && tSt > 0 ? Math.round(tSt * (mSt / pSt)) : null;
  const adjRows = pRows > 0 && mRows > 0 && tRows > 0 ? Math.round(tRows * (mRows / pRows)) : null;

  const canSave = pSt > 0 && mSt > 0;

  async function saveToProject(projectId: number) {
    const t = now();
    const targetCm = tSt > 0 ? Math.round((tSt / pSt) * 10) : 0;
    await db.projectGauges.add({
      projectId,
      name: '빠른 계산',
      patternStitches: pSt,
      patternRows: pRows,
      myStitches: mSt,
      myRows: mRows,
      targetCm,
      resultStitches: adjStitches || 0,
      resultRows: adjRows || 0,
      createdAt: t,
      updatedAt: t,
      cloudId: crypto.randomUUID(),
    });
    setSavePickerOpen(false);
    setToast('프로젝트에 저장했어요');
    setTimeout(() => setToast(null), 1800);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="게이지 계산기" subtitle="빠른 계산용 · 저장은 프로젝트 안에서" back />

      <GaugeCard
        title="도안 게이지"
        subtitle="10cm 기준"
        stitches={patternSt}
        setStitches={setPatternSt}
        rows={patternRows}
        setRows={setPatternRows}
      />

      <GaugeCard
        title="내 게이지"
        subtitle="10cm 기준 · 스와치 측정값"
        stitches={mySt}
        setStitches={setMySt}
        rows={myRows}
        setRows={setMyRows}
      />

      <section>
        <h2 className="section-title mb-2">보정 계산</h2>
        <div className="card-soft space-y-5 p-4">
          <ConvertRow
            label="도안 코수"
            value={targetSt}
            setValue={setTargetSt}
            result={adjStitches}
            unit="코"
            formula={pSt > 0 && mSt > 0 && tSt > 0 ? `${tSt}코 × (${mSt}÷${pSt}) = ${adjStitches}코` : undefined}
          />
          <div className="border-t border-border/70" />
          <ConvertRow
            label="도안 단수"
            value={targetRows}
            setValue={setTargetRows}
            result={adjRows}
            unit="단"
            formula={pRows > 0 && mRows > 0 && tRows > 0 ? `${tRows}단 × (${mRows}÷${pRows}) = ${adjRows}단` : undefined}
          />
        </div>
      </section>

      <button
        type="button"
        disabled={!canSave || projects.length === 0}
        onClick={() => setSavePickerOpen(true)}
        className="btn-primary w-full justify-center disabled:opacity-50"
      >
        <Save className="h-4 w-4" /> 프로젝트에 저장
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        {projects.length === 0 ? '프로젝트를 먼저 만들어주세요' : '게이지 기록은 각 프로젝트 안에 저장돼요'}
      </p>

      {savePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSavePickerOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-card p-4 sm:rounded-3xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-foreground">어디에 저장할까요?</h3>
              <button onClick={() => setSavePickerOpen(false)} className="rounded-full p-1 text-muted-foreground hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
              {projects.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => saveToProject(p.id!)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] hover:bg-secondary"
                  >
                    <span className="truncate font-semibold text-foreground">{p.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{p.status === 'in_progress' ? '진행중' : p.status === 'planned' ? '예정' : p.status === 'done' ? '완성' : '보류'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-[12px] font-semibold text-background shadow-pop">
          {toast}
        </div>
      )}
    </div>
  );
}

function GaugeCard({
  title, subtitle, stitches, setStitches, rows, setRows,
}: {
  title: string; subtitle: string;
  stitches: string; setStitches: (v: string) => void;
  rows: string; setRows: (v: string) => void;
}) {
  return (
    <section>
      <h2 className="section-title mb-2">{title}</h2>
      <div className="card-soft p-4">
        <p className="mb-3 text-[11.5px] text-muted-foreground">{subtitle}</p>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="코수 (10cm)" value={stitches} onChange={setStitches} placeholder="예: 22" />
          <NumField label="단수 (10cm)" value={rows} onChange={setRows} placeholder="예: 30" />
        </div>
      </div>
    </section>
  );
}

function NumField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-center text-[16px] font-semibold tabular-nums outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
      />
    </label>
  );
}

function ConvertRow({
  label, value, setValue, result, unit, formula,
}: {
  label: string; value: string; setValue: (v: string) => void;
  result: number | null; unit: string; formula?: string;
}) {
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={`예: 100${unit}`}
          className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-center text-[16px] font-semibold tabular-nums outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
        />
      </label>
      <div className="mt-3 rounded-xl bg-primary-soft px-4 py-3 text-center">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-primary/70">내 게이지 기준</div>
        <div className="mt-1 text-[40px] font-extrabold leading-none tracking-tight text-primary tabular-nums">
          {result !== null ? result : '—'}
          <span className="ml-1 text-[18px] font-bold">{unit}</span>
        </div>
        {formula && (
          <div className="mt-2 text-[11px] text-muted-foreground tabular-nums">{formula}</div>
        )}
      </div>
    </div>
  );
}