import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import PrivacyNote from '@/components/PrivacyNote';
import { ImageInput } from '@/components/ImageInput';
import ReverseProjectsSection from '@/components/ReverseProjectsSection';
import { Save, Trash2 } from 'lucide-react';

export default function PatternForm() {
  const { id } = useParams();
  const pid = id ? Number(id) : undefined;
  const editing = !!pid;
  const nav = useNavigate();
  const existing = useLiveQuery(() => (pid ? db.patterns.get(pid) : undefined), [pid]);

  const [f, setF] = useState({ name: '', designer: '', source: '', link: '', difficulty: '', sizeInfo: '', note: '' });
  const [image, setImage] = useState<string | undefined>(undefined);
  const [hyd, setHyd] = useState(false);
  useEffect(() => {
    if (editing && existing && !hyd) {
      setF({
        name: existing.name, designer: existing.designer || '', source: existing.source || '',
        link: existing.link || '', difficulty: existing.difficulty || '', sizeInfo: existing.sizeInfo || '', note: existing.note || ''
      });
      setImage(existing.imageDataUrl);
      setHyd(true);
    }
  }, [editing, existing, hyd]);

  async function save() {
    if (!f.name.trim()) return alert('도안명을 입력해 주세요.');
    const t = now();
    const payload = { ...f, imageDataUrl: image, updatedAt: t };
    if (editing && pid) await db.patterns.update(pid, payload);
    else await db.patterns.add({ ...payload, createdAt: t });
    nav('/library/patterns');
  }
  async function remove() {
    if (!pid) return;
    if (!confirm('이 도안을 삭제할까요?')) return;
    await db.projectPatterns.where('patternId').equals(pid).delete();
    await db.patterns.delete(pid);
    nav('/library/patterns');
  }
  const u = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <PageHeader title={editing ? '도안 수정' : '새 도안'} back />
      <Field label="대표 이미지">
        <ImageInput value={image} onChange={setImage} aspect="video" />
      </Field>
      <Field label="도안명 *"><input className={inp} value={f.name} onChange={u('name')} /></Field>
      <Field label="디자이너"><input className={inp} value={f.designer} onChange={u('designer')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="출처/구매처"><input className={inp} value={f.source} onChange={u('source')} /></Field>
        <Field label="난이도"><input className={inp} value={f.difficulty} onChange={u('difficulty')} placeholder="초·중·상" /></Field>
      </div>
      <Field label="도안 링크"><input className={inp} value={f.link} onChange={u('link')} placeholder="https://" /></Field>
      <Field label="사이즈 정보"><input className={inp} value={f.sizeInfo} onChange={u('sizeInfo')} /></Field>
      <Field label="메모"><textarea className={`${inp} min-h-[80px]`} value={f.note} onChange={u('note')} /></Field>
      {editing && <ReverseProjectsSection kind="pattern" refId={pid} />}
      <PrivacyNote kind="memo" />
      <Actions editing={editing} onSave={save} onRemove={remove} />
    </div>
  );
}

const inp = 'w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
function Actions({ editing, onSave, onRemove }: { editing: boolean; onSave: () => void; onRemove: () => void }) {
  return (
    <div className="sticky bottom-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
      <div className="flex gap-2">
        {editing && (
          <button onClick={onRemove} className="rounded-full border border-destructive/30 px-4 py-2.5 text-sm text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button onClick={onSave} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-soft">
          <Save className="h-4 w-4" /> 저장
        </button>
      </div>
    </div>
  );
}
