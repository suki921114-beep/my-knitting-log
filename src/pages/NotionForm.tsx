import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { ImageInput } from '@/components/ImageInput';
import ReverseProjectsSection from '@/components/ReverseProjectsSection';
import { Save, Trash2 } from 'lucide-react';

export default function NotionForm() {
  const { id } = useParams();
  const nid = id ? Number(id) : undefined;
  const editing = !!nid;
  const nav = useNavigate();
  const existing = useLiveQuery(() => (nid ? db.notions.get(nid) : undefined), [nid]);
  const [f, setF] = useState({ name: '', kind: '', quantity: 0, shop: '', note: '' });
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [hyd, setHyd] = useState(false);
  useEffect(() => {
    if (editing && existing && !hyd) {
      setF({ name: existing.name, kind: existing.kind || '', quantity: existing.quantity || 0, shop: existing.shop || '', note: existing.note || '' });
      setPhoto(existing.photoDataUrl);
      setHyd(true);
    }
  }, [editing, existing, hyd]);

  async function save() {
    if (!f.name.trim()) return alert('품목명을 입력해 주세요.');
    const t = now();
    const payload = { ...f, photoDataUrl: photo, updatedAt: t };
    if (editing && nid) await db.notions.update(nid, payload);
    else await db.notions.add({ ...payload, createdAt: t });
    nav('/library/notions');
  }
  async function remove() {
    if (!nid || !confirm('이 부자재를 삭제할까요?')) return;
    await db.projectNotions.where('notionId').equals(nid).delete();
    await db.notions.delete(nid); nav('/library/notions');
  }
  const u = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: k === 'quantity' ? Number(e.target.value) || 0 : e.target.value });

  return (
    <div className="space-y-4">
      <PageHeader title={editing ? '부자재 수정' : '새 부자재'} back />
      <Field label="대표 이미지">
        <ImageInput value={photo} onChange={setPhoto} aspect="square" />
      </Field>
      <Field label="품목명 *"><input className={inp} value={f.name} onChange={u('name')} placeholder="단추, 마커..." /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="종류"><input className={inp} value={f.kind} onChange={u('kind')} /></Field>
        <Field label="수량"><input type="number" inputMode="numeric" className={inp} value={f.quantity} onChange={u('quantity')} /></Field>
      </div>
      <Field label="구매처"><input className={inp} value={f.shop} onChange={u('shop')} /></Field>
      <Field label="메모"><textarea className={`${inp} min-h-[72px]`} value={f.note} onChange={u('note')} /></Field>
      {editing && <ReverseProjectsSection kind="notion" refId={nid} />

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
