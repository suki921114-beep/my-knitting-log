import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now, Yarn } from '@/lib/db';
import { Plus, X, Search, Check, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface YarnLink {
  id?: number; // existing projectYarn id
  yarnId: number;
  usedGrams: number;
  plannedGrams?: number;
  colorNote?: string;
  usageNote?: string;
}

interface Props {
  links: YarnLink[];
  onChange: (l: YarnLink[]) => void;
  /** When true (planned project), shows planned-vs-remaining shortage UI instead of usedGrams */
  showPlanned?: boolean;
  /** Project id being edited; excluded from "used by other projects" calc */
  currentProjectId?: number;
}

export default function YarnPicker({ links, onChange, showPlanned, currentProjectId }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const yarns = useLiveQuery(() => db.yarns.orderBy('updatedAt').reverse().toArray(), []) || [];
  const yarnMap = useMemo(() => new Map(yarns.map(y => [y.id!, y])), [yarns]);

  // Used by *other* projects — for shortage calc when planning
  const allLinks = useLiveQuery(() => db.projectYarns.toArray(), []) || [];
  const usedByOthers = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of allLinks) {
      if (currentProjectId && l.projectId === currentProjectId) continue;
      m.set(l.yarnId, (m.get(l.yarnId) || 0) + (l.usedGrams || 0));
    }
    return m;
  }, [allLinks, currentProjectId]);

  function update(idx: number, patch: Partial<YarnLink>) {
    const next = links.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }
  function remove(idx: number) {
    onChange(links.filter((_, i) => i !== idx));
  }
  function addYarn(y: Yarn) {
    if (links.some(l => l.yarnId === y.id)) {
      setPickerOpen(false);
      return;
    }
    onChange([...links, { yarnId: y.id!, usedGrams: 0 }]);
    setPickerOpen(false);
  }

  return (
    <div className="space-y-2">
      {links.length === 0 && (
        <p className="rounded-xl bg-secondary/50 px-3 py-3 text-center text-xs text-muted-foreground">
          아직 연결된 실이 없어요.
        </p>
      )}

      {links.map((l, i) => {
        const y = yarnMap.get(l.yarnId);
        const remaining = y ? y.totalGrams - (usedByOthers.get(l.yarnId) || 0) : 0;
        const planned = l.plannedGrams || 0;
        const shortage = planned > 0 ? planned - remaining : 0;
        return (
          <div key={i} className="card-soft p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{y?.name || '실'}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {y?.brand} {y?.colorName && `· ${y.colorName}`} {y?.colorCode && `(${y.colorCode})`}
                </div>
              </div>
              <button onClick={() => remove(i)} className="rounded-full p-1 text-muted-foreground hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            {showPlanned ? (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={l.plannedGrams ?? ''}
                    onChange={e => update(i, { plannedGrams: e.target.value === '' ? undefined : Number(e.target.value) || 0 })}
                    className="w-24 rounded-lg border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground">g 예상 소요</span>
                  <input
                    value={l.colorNote || ''}
                    onChange={e => update(i, { colorNote: e.target.value })}
                    placeholder="색상 메모"
                    className="flex-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                {y && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-secondary/50 px-2.5 py-1.5 text-[11.5px]">
                    <span className="text-muted-foreground">
                      잔여 <span className="font-semibold text-foreground tabular-nums">{remaining}g</span>
                      <span className="opacity-70"> / 총 {y.totalGrams}g</span>
                    </span>
                    {planned > 0 && (
                      shortage > 0 ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                          <AlertTriangle className="h-3 w-3" /> {shortage}g 부족
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-primary">
                          <CheckCircle2 className="h-3 w-3" /> 충분
                        </span>
                      )
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={l.usedGrams}
                  onChange={e => update(i, { usedGrams: Number(e.target.value) || 0 })}
                  className="w-24 rounded-lg border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                  placeholder="0"
                />
                <span className="text-xs text-muted-foreground">g 사용</span>
                <input
                  value={l.colorNote || ''}
                  onChange={e => update(i, { colorNote: e.target.value })}
                  placeholder="색상 메모"
                  className="flex-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                />
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 py-2.5 text-sm font-medium text-primary"
      >
        <Plus className="h-4 w-4" /> 실 추가
      </button>

      {pickerOpen && (
        <YarnPickerModal yarns={yarns} onClose={() => setPickerOpen(false)} onPick={addYarn} />
      )}
    </div>
  );
}

function YarnPickerModal({
  yarns,
  onClose,
  onPick,
}: {
  yarns: Yarn[];
  onClose: () => void;
  onPick: (y: Yarn) => void;
}) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return yarns;
    return yarns.filter(y =>
      [y.name, y.brand, y.colorName, y.colorCode].filter(Boolean).some(v => v!.toLowerCase().includes(s))
    );
  }, [q, yarns]);

  const similar = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return yarns.filter(y => y.name.toLowerCase().includes(s) || (y.brand || '').toLowerCase().includes(s)).slice(0, 3);
  }, [q, yarns]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-card p-4 sm:rounded-3xl"
        onClick={e => e.stopPropagation()}
      >
        {!creating ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold">실 선택</h3>
              <button onClick={onClose} className="rounded-full p-1 text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="이름·브랜드·컬러로 검색"
                className="w-full rounded-full border bg-background py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">검색 결과가 없어요.</p>
              )}
              {filtered.map(y => (
                <button
                  key={y.id}
                  onClick={() => onPick(y)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-secondary"
                >
                  <div>
                    <div className="text-sm font-medium text-ink">{y.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {y.brand} {y.colorName && `· ${y.colorName}`}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{y.totalGrams}g</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setCreating(true)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 py-2.5 text-sm font-medium text-primary"
            >
              <Plus className="h-4 w-4" /> 새 실 추가
            </button>
          </>
        ) : (
          <QuickAddYarn
            initialName={q}
            similar={similar}
            onCancel={() => setCreating(false)}
            onCreated={onPick}
          />
        )}
      </div>
    </div>
  );
}

function QuickAddYarn({
  initialName,
  similar,
  onCancel,
  onCreated,
}: {
  initialName: string;
  similar: Yarn[];
  onCancel: () => void;
  onCreated: (y: Yarn) => void;
}) {
  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState('');
  const [colorName, setColorName] = useState('');
  const [colorCode, setColorCode] = useState('');
  const [totalGrams, setTotalGrams] = useState<number | ''>('');
  const [note, setNote] = useState('');

  async function save() {
    if (!name.trim()) return;
    const t = now();
    const id = (await db.yarns.add({
      name: name.trim(),
      brand: brand || undefined,
      colorName: colorName || undefined,
      colorCode: colorCode || undefined,
      totalGrams: Number(totalGrams) || 0,
      note: note || undefined,
      createdAt: t,
      updatedAt: t,
    })) as number;
    const y = await db.yarns.get(id);
    if (y) onCreated(y);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">새 실 추가</h3>
        <button onClick={onCancel} className="rounded-full p-1 text-muted-foreground"><X className="h-5 w-5" /></button>
      </div>

      {similar.length > 0 && (
        <div className="mb-3 rounded-xl border border-warm/40 bg-warm/10 p-2.5 text-xs">
          <div className="mb-1 font-medium text-ink">비슷한 실이 있어요:</div>
          <div className="space-y-1">
            {similar.map(s => (
              <button
                key={s.id}
                onClick={() => onCreated(s)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-card"
              >
                <span className="text-sm text-ink">{s.name} <span className="text-muted-foreground">{s.brand}</span></span>
                <Check className="h-3.5 w-3.5 text-primary" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <input className={qaInput} value={name} onChange={e => setName(e.target.value)} placeholder="실 이름 *" />
        <input className={qaInput} value={brand} onChange={e => setBrand(e.target.value)} placeholder="브랜드" />
        <div className="grid grid-cols-2 gap-2">
          <input className={qaInput} value={colorName} onChange={e => setColorName(e.target.value)} placeholder="컬러명" />
          <input className={qaInput} value={colorCode} onChange={e => setColorCode(e.target.value)} placeholder="컬러번호" />
        </div>
        <input
          className={qaInput}
          type="number"
          inputMode="decimal"
          value={totalGrams}
          onChange={e => setTotalGrams(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="총 보유량 (g)"
        />
        <textarea className={`${qaInput} min-h-[60px]`} value={note} onChange={e => setNote(e.target.value)} placeholder="간단 메모 (선택)" />
      </div>
      <button onClick={save} className="mt-3 w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground">
        저장하고 프로젝트에 연결
      </button>
    </div>
  );
}

const qaInput = 'w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary';
