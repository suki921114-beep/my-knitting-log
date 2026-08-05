import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now, RowCounter } from '@/lib/db';
import { Plus, Minus, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useConfirm } from '@/hooks/useConfirm';

function vibrate(ms = 10) {
  try { (navigator as any).vibrate?.(ms); } catch {}
}

export default function RowCounterSection({ projectId }: { projectId: number }) {
  const counters = useLiveQuery(
    () => db.rowCounters.where('projectId').equals(projectId).filter(c => !c.isDeleted).sortBy('createdAt'),
    [projectId]
  ) || [];

  async function addCounter() {
    const t = now();
    await db.rowCounters.add({
      projectId,
      name: `카운터 ${counters.length + 1}`,
      count: 0,
      createdAt: t,
      updatedAt: t,
      cloudId: crypto.randomUUID(),
    });
  }

  return (
    <section className="space-y-2.5">
      <h2 className="section-title">단수 카운터</h2>

      {counters.length === 0 ? (
        <div className="rounded-2xl bg-secondary/60 px-4 py-6 text-center">
          <p className="text-[12.5px] text-muted-foreground">첫 카운터를 만들어 단수를 세어보세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {counters.map(c => <CounterCard key={c.id} counter={c} />)}
        </div>
      )}

      <button
        type="button"
        onClick={addCounter}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border bg-transparent px-4 py-2.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft/40 hover:text-primary"
      >
        <Plus className="h-4 w-4" /> 카운터 추가
      </button>
    </section>
  );
}

function CounterCard({ counter }: { counter: RowCounter }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [name, setName] = useState(counter.name);
  const [goalStr, setGoalStr] = useState(counter.goal?.toString() || '');
  const [editingCount, setEditingCount] = useState(false);
  const [countStr, setCountStr] = useState(String(counter.count));
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const { confirm, dialog } = useConfirm();

  async function update(patch: Partial<RowCounter>) {
    await db.rowCounters.update(counter.id!, { ...patch, updatedAt: now() });
  }
  async function inc() { vibrate(10); await update({ count: counter.count + 1 }); }
  async function dec() { if (counter.count <= 0) return; vibrate(8); await update({ count: counter.count - 1 }); }
  async function reset() { setMenuOpen(false); await update({ count: 0 }); }
  async function remove() {
    setMenuOpen(false);
    const ok = await confirm({
      title: `"${counter.name}" 카운터를 삭제할까요?`,
      description: '휴지통에서 되돌릴 수 있어요.',
      confirmLabel: '삭제',
    });
    if (!ok) return;
    const t = now();
    // soft delete — DB 에는 보존, isDeleted 만 켠다.
    await db.rowCounters.update(counter.id!, {
      isDeleted: true,
      deletedAt: t,
      updatedAt: t,
    } as any);
    toast.success(`"${counter.name}" 카운터를 삭제했어요`, {
      duration: 8000,
      action: {
        label: '되돌리기',
        onClick: async () => {
          const n = now();
          await db.rowCounters.update(counter.id!, {
            isDeleted: false,
            deletedAt: null,
            updatedAt: n,
          } as any);
          toast.success('카운터를 다시 살렸어요');
        },
      },
    });
  }
  async function saveName() {
    const trimmed = name.trim() || counter.name;
    setEditing(false);
    if (trimmed !== counter.name) await update({ name: trimmed });
  }
  /** 직접 입력한 단수 저장 — 비었거나 숫자가 아니면 원래 값으로 되돌린다 */
  async function saveCount() {
    setEditingCount(false);
    const n = parseInt(countStr, 10);
    if (Number.isNaN(n)) return;
    const next = Math.max(0, n);
    if (next !== counter.count) await update({ count: next });
  }
  async function saveGoal() {
    setEditingGoal(false);
    const n = parseInt(goalStr, 10);
    const goal = isNaN(n) || n <= 0 ? undefined : n;
    if (goal !== counter.goal) await update({ goal });
  }

  const pct = counter.goal && counter.goal > 0
    ? Math.min(100, Math.round((counter.count / counter.goal) * 100))
    : 0;

  return (
    <div className="card-soft relative flex flex-col p-3">
      {dialog}
      {/* Header: name + menu */}
      <div className="mb-1.5 flex items-start justify-between gap-1">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setName(counter.name); setEditing(false); } }}
            className="min-w-0 flex-1 rounded-md border border-input bg-card px-1.5 py-0.5 text-[12.5px] font-semibold text-foreground outline-none focus:border-ring/60"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setName(counter.name); setEditing(true); }}
            className="min-w-0 flex-1 truncate text-left text-[12.5px] font-semibold text-foreground"
          >
            {counter.name}
          </button>
        )}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="-m-1 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            aria-label="메뉴"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-pop">
              <MenuItem icon={Pencil} onClick={() => { setMenuOpen(false); setName(counter.name); setEditing(true); }}>이름 수정</MenuItem>
              <MenuItem icon={RotateCcw} onClick={reset}>0으로 초기화</MenuItem>
              <MenuItem icon={Trash2} onClick={remove} danger>삭제</MenuItem>
            </div>
          )}
        </div>
      </div>

      {/* Big count — 숫자를 눌러 직접 입력할 수 있다.
          한참 뜨다가 중간부터 세거나, 잘못 누른 걸 바로잡을 때 +/- 만으로는 번거롭다. */}
      <div className="text-center">
        {editingCount ? (
          <input
            autoFocus
            type="number"
            inputMode="numeric"
            min={0}
            value={countStr}
            onChange={e => setCountStr(e.target.value)}
            onFocus={e => e.currentTarget.select()}
            onBlur={saveCount}
            onKeyDown={e => {
              if (e.key === 'Enter') saveCount();
              if (e.key === 'Escape') { setCountStr(String(counter.count)); setEditingCount(false); }
            }}
            aria-label="단수 직접 입력"
            className="w-full rounded-lg border border-input bg-card px-1 py-0.5 text-center text-[30px] font-extrabold leading-none tracking-tight tabular-nums outline-none focus:border-ring/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setCountStr(String(counter.count)); setEditingCount(true); }}
            aria-label={`현재 ${counter.count}단, 눌러서 직접 입력`}
            className="w-full text-[34px] font-extrabold leading-none tracking-tight text-foreground tabular-nums"
          >
            {counter.count}
            <span className="ml-0.5 text-[13px] font-bold text-muted-foreground">단</span>
          </button>
        )}
      </div>

      {/* Goal / progress */}
      <div className="mt-1.5">
        {editingGoal ? (
          <div className="flex items-center justify-center gap-1">
            <span className="text-[10.5px] text-muted-foreground">목표</span>
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              value={goalStr}
              onChange={e => setGoalStr(e.target.value)}
              onBlur={saveGoal}
              onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') { setGoalStr(counter.goal?.toString() || ''); setEditingGoal(false); } }}
              placeholder="—"
              className="w-12 rounded-md border border-input bg-card px-1 py-0.5 text-center text-[11px] outline-none focus:border-ring/60"
            />
            <span className="text-[10.5px] text-muted-foreground">단</span>
          </div>
        ) : counter.goal ? (
          <button
            type="button"
            onClick={() => { setGoalStr(counter.goal!.toString()); setEditingGoal(true); }}
            className="block w-full text-left"
          >
            <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
              <span>/ {counter.goal}단</span>
              <span className="font-semibold tabular-nums">{pct}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setGoalStr(''); setEditingGoal(true); }}
            className="block w-full text-center text-[10.5px] text-muted-foreground hover:text-foreground"
          >
            + 목표 설정
          </button>
        )}
      </div>

      {/* +/- buttons */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={dec}
          disabled={counter.count <= 0}
          aria-label="감소"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition active:scale-90 disabled:opacity-40"
        >
          <Minus className="h-5 w-5" strokeWidth={2.6} />
        </button>
        <button
          type="button"
          onClick={inc}
          aria-label="증가"
          className="flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft transition active:scale-95"
        >
          <Plus className="h-5 w-5" strokeWidth={2.8} />
        </button>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger }: { icon: any; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-secondary ${danger ? 'text-destructive' : 'text-foreground'}`}
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}
