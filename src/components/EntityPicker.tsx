import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now, Pattern, Needle, Notion } from '@/lib/db';
import { Plus, X, Search, Check } from 'lucide-react';

export type EntityKind = 'pattern' | 'needle' | 'notion';

interface BaseLink {
  id?: number;
  refId: number;
  note?: string;
}
export interface PatternLink extends BaseLink {}
export interface NeedleLink extends BaseLink {}
export interface NotionLink extends BaseLink {
  quantity?: number;
}

interface Props<T extends BaseLink> {
  kind: EntityKind;
  links: T[];
  onChange: (l: T[]) => void;
}

const META = {
  pattern: {
    label: '도안',
    addLabel: '도안 추가',
    emptyText: '아직 연결된 도안이 없어요.',
    pickerTitle: '도안 선택',
    quickTitle: '새 도안 추가',
  },
  needle: {
    label: '바늘',
    addLabel: '바늘 추가',
    emptyText: '아직 연결된 바늘이 없어요.',
    pickerTitle: '바늘 선택',
    quickTitle: '새 바늘 추가',
  },
  notion: {
    label: '부자재',
    addLabel: '부자재 추가',
    emptyText: '아직 연결된 부자재가 없어요.',
    pickerTitle: '부자재 선택',
    quickTitle: '새 부자재 추가',
  },
} as const;

/** QuickAdd 폼 입력 공통 클래스 */
const qaInput =
  'w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary';

export default function EntityPicker<T extends BaseLink>({ kind, links, onChange }: Props<T>) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const meta = META[kind];

  const items = useLiveQuery(async () => {
    if (kind === 'pattern') return db.patterns.orderBy('updatedAt').reverse().filter(x => !x.isDeleted).toArray();
    if (kind === 'needle') return db.needles.orderBy('updatedAt').reverse().filter(x => !x.isDeleted).toArray();
    return db.notions.orderBy('updatedAt').reverse().filter(x => !x.isDeleted).toArray();
  }, [kind]) || [];

  const map = useMemo(() => new Map<number, any>((items as any[]).map(it => [it.id as number, it])), [items]);

  function update(idx: number, patch: Partial<T>) {
    const next = links.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }
  function remove(idx: number) {
    onChange(links.filter((_, i) => i !== idx));
  }
  function add(refId: number) {
    if (links.some(l => l.refId === refId)) {
      setPickerOpen(false);
      return;
    }
    const base: any = { refId };
    if (kind === 'notion') base.quantity = 1;
    onChange([...links, base as T]);
    setPickerOpen(false);
  }

  return (
    <div className="space-y-2">
      {links.length === 0 && (
        <p className="rounded-xl bg-secondary/50 px-3 py-3 text-center text-xs text-muted-foreground">
          {meta.emptyText}
        </p>
      )}

      {links.map((l, i) => {
        const it: any = map.get(l.refId);
        return (
          <div key={l.id ?? `new-${l.refId}`} className="card-soft p-3">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">
                  {kind === 'pattern' && (it?.name || '도안')}
                  {kind === 'needle' && `${it?.type || '바늘'}${it?.sizeMm ? ` · ${it.sizeMm}` : ''}`}
                  {kind === 'notion' && (it?.name || '부자재')}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {kind === 'pattern' && [it?.designer, it?.difficulty].filter(Boolean).join(' · ')}
                  {kind === 'needle' && [it?.brand, it?.material, it?.length].filter(Boolean).join(' · ')}
                  {kind === 'notion' && [it?.kind, it?.shop].filter(Boolean).join(' · ')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
                aria-label="제거"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {kind === 'notion' && (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={(l as any).quantity ?? 1}
                  onChange={e => update(i, { quantity: Number(e.target.value) || 0 } as any)}
                  className="w-20 rounded-lg border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                />
                <span className="text-xs text-muted-foreground">개</span>
              </div>
            )}
            <input
              value={l.note || ''}
              onChange={e => update(i, { note: e.target.value } as any)}
              placeholder="메모"
              className="mt-2 w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            />
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 py-2.5 text-sm font-medium text-primary"
      >
        <Plus className="h-4 w-4" /> {meta.addLabel}
      </button>

      {pickerOpen && (
        <PickerModal
          kind={kind}
          items={items as any[]}
          onClose={() => setPickerOpen(false)}
          onPick={id => add(id)}
        />
      )}
    </div>
  );
}

function PickerModal({
  kind,
  items,
  onClose,
  onPick,
}: {
  kind: EntityKind;
  items: any[];
  onClose: () => void;
  onPick: (id: number) => void;
}) {
  const meta = META[kind];
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  // ESC 닫기 + 배경 스크롤 잠금
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it: any) => {
      const fields =
        kind === 'pattern'
          ? [it.name, it.designer, it.source]
          : kind === 'needle'
          ? [it.type, it.sizeMm, it.brand, it.material]
          : [it.name, it.kind, it.shop];
      return fields
        .filter(Boolean)
        .some((v: unknown) => String(v).toLowerCase().includes(s));
    });
  }, [q, items, kind]);

  const similar = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return filtered.slice(0, 3);
  }, [q, filtered]);

  const body = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        /* vh 는 주소창·키보드 높이를 반영하지 않아 시트가 화면 밖으로 나간다
           (저장 버튼이 잘림). dvh 를 쓰고, 아래는 제스처 바만큼 더 띄운다. */
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:rounded-3xl sm:pb-5"
        onClick={e => e.stopPropagation()}
      >
        {!creating ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold">{meta.pickerTitle}</h3>
              <button type="button" onClick={onClose} className="rounded-full p-1 text-muted-foreground" aria-label="닫기">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="검색"
                className="w-full rounded-full border bg-background py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  아직 등록된 {meta.label}이(가) 없어요. 아래에서 바로 추가할 수 있어요.
                </p>
              ) : (
                filtered.length === 0 && (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">검색 결과가 없어요.</p>
                )
              )}
              {filtered.map((it: any) => (
                <button
                  type="button"
                  key={it.id}
                  onClick={() => onPick(it.id)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-secondary"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">
                      {kind === 'pattern' && it.name}
                      {kind === 'needle' && `${it.type}${it.sizeMm ? ` · ${it.sizeMm}` : ''}`}
                      {kind === 'notion' && it.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {kind === 'pattern' && [it.designer, it.difficulty].filter(Boolean).join(' · ')}
                      {kind === 'needle' && [it.brand, it.material, it.length].filter(Boolean).join(' · ')}
                      {kind === 'notion' && [it.kind, it.shop].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 py-2.5 text-sm font-medium text-primary"
            >
              <Plus className="h-4 w-4" /> {meta.quickTitle}
            </button>
          </>
        ) : (
          <QuickAdd kind={kind} initial={q} similar={similar} onCancel={() => setCreating(false)} onCreated={onPick} />
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(body, document.body) : body;
}

function QuickAdd({
  kind,
  initial,
  similar,
  onCancel,
  onCreated,
}: {
  kind: EntityKind;
  initial: string;
  similar: any[];
  onCancel: () => void;
  onCreated: (id: number) => void;
}) {
  const meta = META[kind];
  const [name, setName] = useState(initial);
  const [extra1, setExtra1] = useState(''); // pattern: designer | needle: sizeMm | notion: kind
  const [extra2, setExtra2] = useState(''); // pattern: link    | needle: brand  | notion: quantity
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 바늘은 종류를 비워도 기본값('대바늘')으로 저장 가능
  const canSave = kind === 'needle' ? true : name.trim().length > 0;

  async function save() {
    if (saving) return;
    if (!canSave) {
      setError('이름을 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const t = now();
      const syncMeta = {
        createdAt: t,
        updatedAt: t,
        cloudId: crypto.randomUUID(),
        isDeleted: false,
        deletedAt: null,
      };
      let id: number;
      if (kind === 'pattern') {
        id = (await db.patterns.add({
          name: name.trim(),
          designer: extra1.trim() || undefined,
          link: extra2.trim() || undefined,
          note: note.trim() || undefined,
          ...syncMeta,
        } as Pattern)) as number;
      } else if (kind === 'needle') {
        id = (await db.needles.add({
          type: name.trim() || '대바늘',
          sizeMm: extra1.trim() || undefined,
          brand: extra2.trim() || undefined,
          note: note.trim() || undefined,
          ...syncMeta,
        } as Needle)) as number;
      } else {
        id = (await db.notions.add({
          name: name.trim(),
          kind: extra1.trim() || undefined,
          quantity: extra2.trim() ? Number(extra2) || 0 : undefined,
          note: note.trim() || undefined,
          ...syncMeta,
        } as Notion)) as number;
      }
      onCreated(id);
    } catch (e) {
      console.error('[EntityPicker] 빠른 추가 실패', e);
      setError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setSaving(false);
    }
  }

  const placeholders = {
    pattern: { name: '도안명 *', e1: '디자이너', e2: '도안 링크' },
    needle: { name: '종류 (대바늘/코바늘…)', e1: '호수 / mm', e2: '브랜드' },
    notion: { name: '품목명 *', e1: '종류', e2: '수량' },
  } as const;

  const ph = placeholders[kind];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">{meta.quickTitle}</h3>
        <button type="button" onClick={onCancel} className="rounded-full p-1 text-muted-foreground" aria-label="뒤로">
          <X className="h-5 w-5" />
        </button>
      </div>

      {similar.length > 0 && (
        <div className="mb-3 rounded-xl border border-warm/40 bg-warm/10 p-2.5 text-xs">
          <div className="mb-1 font-medium text-ink">비슷한 항목이 있어요:</div>
          <div className="space-y-1">
            {similar.map((s: any) => (
              <button
                type="button"
                key={s.id}
                onClick={() => onCreated(s.id)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-card"
              >
                <span className="text-sm text-ink">
                  {kind === 'needle' ? `${s.type}${s.sizeMm ? ` · ${s.sizeMm}` : ''}` : s.name}
                </span>
                <Check className="h-3.5 w-3.5 text-primary" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <input autoFocus className={qaInput} value={name} onChange={e => setName(e.target.value)} placeholder={ph.name} />
        <div className="grid grid-cols-2 gap-2">
          <input className={qaInput} value={extra1} onChange={e => setExtra1(e.target.value)} placeholder={ph.e1} />
          <input
            className={qaInput}
            value={extra2}
            onChange={e => setExtra2(e.target.value)}
            placeholder={ph.e2}
            inputMode={kind === 'notion' ? 'numeric' : undefined}
          />
        </div>
        <textarea className={`${qaInput} min-h-[60px]`} value={note} onChange={e => setNote(e.target.value)} placeholder="간단 메모 (선택)" />
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={!canSave || saving}
        className="mt-3 w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {saving ? '저장 중…' : '저장하고 프로젝트에 연결'}
      </button>
    </div>
  );
}
