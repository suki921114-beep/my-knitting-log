import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now, GaugePreset } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { Bookmark, X } from 'lucide-react';

export default function GaugeCalculator() {
  const presets = useLiveQuery(
    () => db.gaugePresets.orderBy('updatedAt').reverse().limit(3).toArray(),
    []
  ) || [];

  const [patternSt, setPatternSt] = useState('');
  const [patternRows, setPatternRows] = useState('');
  const [mySt, setMySt] = useState('');
  const [myRows, setMyRows] = useState('');
  const [targetSt, setTargetSt] = useState('');
  const [targetRows, setTargetRows] = useState('');

  const num = (v: string) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  const pSt = num(patternSt);
  const pRows = num(patternRows);
  const mSt = num(mySt);
  const mRows = num(myRows);
  const tSt = num(targetSt);
  const tRows = num(targetRows);

  const adjStitches = pSt > 0 && mSt > 0 && tSt > 0 ? Math.round(tSt * (mSt / pSt)) : null;
  const adjRows = pRows > 0 && mRows > 0 && tRows > 0 ? Math.round(tRows * (mRows / pRows)) : null;

  function applyPreset(p: GaugePreset) {
    setMySt(p.stitches.toString());
    setMyRows(p.rows.toString());
  }

  async function savePreset() {
    if (mSt <= 0 || mRows <= 0) {
      alert('내 게이지의 코수와 단수를 모두 입력해주세요.');
      return;
    }
    const name = prompt('이 게이지의 이름을 입력하세요 (예: 구름실 + 5mm)');
    if (!name?.trim()) return;
    const t = now();
    const all = await db.gaugePresets.orderBy('updatedAt').reverse().toArray();
    if (all.length >= 3) {
      const oldest = all.slice(2);
      await db.gaugePresets.bulkDelete(oldest.map(o => o.id!));
    }
    await db.gaugePresets.add({
      name: name.trim(),
      stitches: mSt,
      rows: mRows,
      createdAt: t,
      updatedAt: t,
    });
  }

  async function removePreset(id: number) {
    await db.gaugePresets.delete(id);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="게이지 계산기" back />

      {presets.length > 0 && (
        <div>
          <h2 className="section-title mb-2">즐겨찾기</h2>
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <div key={p.id} className="group flex items-center gap-1 rounded-full bg-primary-soft pl-3 pr-1.5 py-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="text-[12px] font-semibold text-primary"
                >
                  {p.name} <span className="ml-1 font-normal opacity-70 tabular-nums">{p.stitches}코·{p.rows}단</span>
                </button>
                <button
                  type="button"
                  onClick={() => removePreset(p.id!)}
                  aria-label="삭제"
                  className="flex h-5 w-5 items-center justify-center rounded-full text-primary/60 hover:bg-primary/15 hover:text-primary"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
        onClick={savePreset}
        className="btn-primary w-full justify-center"
      >
        <Bookmark className="h-4 w-4" /> 이 게이지 저장
      </button>
      <p className="text-center text-[11px] text-muted-foreground">즐겨찾기는 최근 3개까지만 보관돼요</p>
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
