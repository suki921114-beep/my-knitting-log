import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now, ProjectGauge, RowCounter } from '@/lib/db';
import { Plus, Trash2, ChevronDown, Save, Target } from 'lucide-react';

interface Props { projectId: number }

const blank = (projectId: number): ProjectGauge => ({
  projectId,
  name: '',
  patternStitches: 0,
  patternRows: 0,
  myStitches: 0,
  myRows: 0,
  targetCm: 0,
  resultStitches: 0,
  resultRows: 0,
  memo: '',
  createdAt: 0,
  updatedAt: 0,
});

export default function ProjectGaugeSection({ projectId }: Props) {
  const items = useLiveQuery(
    () => db.projectGauges.where('projectId').equals(projectId).sortBy('createdAt'),
    [projectId]
  ) || [];

  const [openId, setOpenId] = useState<number | 'new' | null>(null);

  async function addNew() {
    const t = now();
    const id = await db.projectGauges.add({
      ...blank(projectId),
      name: `계산 ${items.length + 1}`,
      createdAt: t,
      updatedAt: t,
    });
    setOpenId(id);
  }

  return (
    <section className="space-y-2.5">
      <h2 className="section-title">게이지 계산기</h2>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-secondary/60 px-4 py-6 text-center">
          <p className="text-[12.5px] text-muted-foreground">부위별 게이지 계산을 저장해두세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(it => (
            <GaugeItem
              key={it.id}
              gauge={it}
              projectId={projectId}
              open={openId === it.id}
              onToggle={() => setOpenId(openId === it.id ? null : it.id!)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addNew}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border bg-transparent px-4 py-2.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft/40 hover:text-primary"
      >
        <Plus className="h-4 w-4" /> 계산 추가
      </button>
    </section>
  );
}

function GaugeItem({ gauge, projectId, open, onToggle }: { gauge: ProjectGauge; projectId: number; open: boolean; onToggle: () => void }) {
  const counters = useLiveQuery(
    () => db.rowCounters.where('projectId').equals(projectId).toArray(),
    [projectId]
  ) || [];

  const [name, setName] = useState(gauge.name);
  const [pSt, setPSt] = useState(str(gauge.patternStitches));
  const [pRows, setPRows] = useState(str(gauge.patternRows));
  const [mSt, setMSt] = useState(str(gauge.myStitches));
  const [mRows, setMRows] = useState(str(gauge.myRows));
  const [tCm, setTCm] = useState(str(gauge.targetCm));
  const [memo, setMemo] = useState(gauge.memo || '');

  const pStN = num(pSt), pRowsN = num(pRows), mStN = num(mSt), mRowsN = num(mRows), tCmN = num(tCm);
  const resultSt = pStN > 0 && mStN > 0 && tCmN > 0 ? Math.round((tCmN / 10) * mStN) : 0;
  const resultRows = pRowsN > 0 && mRowsN > 0 && tCmN > 0 ? Math.round((tCmN / 10) * mRowsN) : 0;

  async function save() {
    await db.projectGauges.update(gauge.id!, {
      name: name.trim() || gauge.name,
      patternStitches: pStN,
      patternRows: pRowsN,
      myStitches: mStN,
      myRows: mRowsN,
      targetCm: tCmN,
      resultStitches: resultSt,
      resultRows: resultRows,
      memo: memo.trim() || undefined,
      updatedAt: now(),
    });
  }

  async function remove() {
    if (confirm(`"${gauge.name}" 계산을 삭제할까요?`)) {
      await db.projectGauges.delete(gauge.id!);
    }
  }

  async function applyToCounter(counterId: number, target: 'rows' | 'stitches') {
    const value = target === 'rows' ? resultRows : resultSt;
    if (value <= 0) return;
    await db.rowCounters.update(counterId, { goal: value, updatedAt: now() });
  }

  return (
    <div className="card-soft overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-foreground">{gauge.name}</div>
          {(gauge.resultStitches > 0 || gauge.resultRows > 0) && (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground tabular-nums">
              {gauge.targetCm > 0 && `${gauge.targetCm}cm · `}
              {gauge.resultStitches > 0 && `${gauge.resultStitches}코`}
              {gauge.resultStitches > 0 && gauge.resultRows > 0 && ' / '}
              {gauge.resultRows > 0 && `${gauge.resultRows}단`}
            </div>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/70 px-3.5 py-3">
          <Field label="이름">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: 몸통, 소매"
              className="w-full rounded-lg border border-input bg-card px-2.5 py-2 text-[13px] outline-none focus:border-ring/60"
            />
          </Field>

          <div>
            <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">도안 게이지 (10cm)</div>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="코수" value={pSt} onChange={setPSt} />
              <NumField label="단수" value={pRows} onChange={setPRows} />
            </div>
          </div>

          <div>
            <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">내 게이지 (10cm)</div>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="코수" value={mSt} onChange={setMSt} />
              <NumField label="단수" value={mRows} onChange={setMRows} />
            </div>
          </div>

          <Field label="목표 치수 (cm)">
            <input
              type="number"
              inputMode="decimal"
              value={tCm}
              onChange={e => setTCm(e.target.value)}
              placeholder="예: 50"
              className="w-full rounded-lg border border-input bg-card px-2.5 py-2 text-center text-[14px] font-semibold tabular-nums outline-none focus:border-ring/60"
            />
          </Field>

          <div className="rounded-xl bg-primary-soft px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary/70">필요 수량</div>
            <div className="mt-1 flex items-baseline justify-around gap-2">
              <div className="text-center">
                <div className="text-[26px] font-extrabold leading-none tabular-nums text-primary">
                  {resultSt || '—'}
                </div>
                <div className="mt-0.5 text-[10.5px] font-semibold text-primary/70">코</div>
              </div>
              <div className="h-8 w-px bg-primary/20" />
              <div className="text-center">
                <div className="text-[26px] font-extrabold leading-none tabular-nums text-primary">
                  {resultRows || '—'}
                </div>
                <div className="mt-0.5 text-[10.5px] font-semibold text-primary/70">단</div>
              </div>
            </div>
          </div>

          <Field label="메모 (선택)">
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              rows={2}
              placeholder="예: 시보리 부분"
              className="w-full resize-none rounded-lg border border-input bg-card px-2.5 py-2 text-[12.5px] outline-none focus:border-ring/60"
            />
          </Field>

          {resultRows > 0 && counters.length > 0 && (
            <div className="rounded-xl bg-accent-soft px-3 py-2.5">
              <div className="mb-1.5 flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-accent-foreground/80">
                <Target className="h-3 w-3" /> 카운터 목표로 적용
              </div>
              <div className="flex flex-wrap gap-1.5">
                {counters.map(c => (
                  <ApplyButton key={c.id} counter={c} onApply={() => applyToCounter(c.id!, 'rows')} value={resultRows} />
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              className="btn-primary flex-1 justify-center text-[12.5px]"
            >
              <Save className="h-3.5 w-3.5" /> 저장
            </button>
            <button
              type="button"
              onClick={remove}
              className="btn-soft text-destructive"
              aria-label="삭제"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ApplyButton({ counter, onApply, value }: { counter: RowCounter; onApply: () => void | Promise<void>; value: number }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { await onApply(); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="rounded-full bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-soft transition hover:bg-primary-soft active:scale-95"
    >
      {done ? `✓ ${counter.name} ${value}단` : `${counter.name} → ${value}단`}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-semibold text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-card px-2 py-2 text-center text-[14px] font-semibold tabular-nums outline-none focus:border-ring/60"
      />
    </label>
  );
}

function num(v: string) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function str(n: number) { return n > 0 ? n.toString() : ''; }
