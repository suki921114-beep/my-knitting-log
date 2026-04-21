import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { Save, Trash2 } from 'lucide-react';

const TYPES = ['대바늘', '코바늘', '줄바늘', '장갑바늘', '기타'];

export default function NeedleForm() {
  const { id } = useParams();
  const nid = id ? Number(id) : undefined;
  const editing = !!nid;
  const nav = useNavigate();
  const existing = useLiveQuery(() => (nid ? db.needles.get(nid) : undefined), [nid]);
  const [f, setF] = useState({ type: '대바늘', sizeMm: '', brand: '', material: '', length: '', note: '' });
  const [hyd, setHyd] = useState(false);
  useEffect(() => {
    if (editing && existing && !hyd) {
      setF({ type: existing.type, sizeMm: existing.sizeMm || '', brand: existing.brand || '', material: existing.material || '', length: existing.length || '', note: existing.note || '' });
      setHyd(true);
    }
  }, [editing, existing, hyd]);

  async function save() {
    const t = now();
    if (editing && nid) await db.needles.update(nid, { ...f, updatedAt: t });
    else await db.needles.add({ ...f, createdAt: t, updatedAt: t });
    nav('/library/needles');
  }
  async function remove() {
    if (!nid || !confirm('이 바늘을 삭제할까요?')) return;
    await db.needles.delete(nid); nav('/library/needles');
  }
  const u = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <PageHeader title={editing ? '바늘 수정' : '새 바늘'} back />
      <Field label="종류">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map(t => (
            <button key={t} type="button" onClick={() => setF({ ...f, type: t })}
              className={`rounded-full border px-3 py-1.5 text-xs ${f.type === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
              {t}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="호수 / mm"><input className={inp} value={f.sizeMm} onChange={u('sizeMm')} placeholder="4.0mm" /></Field>
        <Field label="브랜드"><input className={inp} value={f.brand} onChange={u('brand')} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="재질"><input className={inp} value={f.material} onChange={u('material')} placeholder="대나무" /></Field>
        <Field label="길이"><input className={inp} value={f.length} onChange={u('length')} placeholder="80cm" /></Field>
      </div>
      <Field label="메모"><textarea className={`${inp} min-h-[72px]`} value={f.note} onChange={u('note')} /></Field>

      <div className="sticky bottom-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2">
          {editing && <button onClick={remove} className="rounded-full border border-destructive/30 px-4 py-2.5 text-sm text-destructive"><Trash2 className="h-4 w-4" /></button>}
          <button onClick={save} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-soft"><Save className="h-4 w-4" /> 저장</button>
        </div>
      </div>
    </div>
  );
}
const inp = 'w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
