import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import ReverseProjectsSection from '@/components/ReverseProjectsSection';
import { Save, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

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
    
    // 공통 업데이트 필드
    const payload = { 
      ...f, 
      updatedAt: t,
      isDeleted: false,
      deletedAt: null
    };
    
    if (editing && nid) {
      await db.needles.update(nid, payload);
    } else {
      await db.needles.add({ 
        ...payload, 
        createdAt: t,
        cloudId: crypto.randomUUID()
      });
    }
    nav('/library/needles');
  }
  async function remove() {
    if (!nid || !confirm('이 바늘을 삭제할까요? 프로젝트에 연결된 사용 기록은 그대로 남아요.')) return;
    const t = Date.now();
    await db.needles.update(nid, {
      isDeleted: true,
      deletedAt: t,
      updatedAt: t,
    } as any);
    nav('/library/needles');
    toast.success('바늘을 삭제했어요', {
      duration: 8000,
      action: {
        label: '되돌리기',
        onClick: async () => {
          const n = Date.now();
          await db.needles.update(nid, {
            isDeleted: false,
            deletedAt: null,
            updatedAt: n,
          } as any);
          toast.success('바늘을 다시 살렸어요');
        },
      },
    });
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
      {editing && <ReverseProjectsSection kind="needle" refId={nid} />}

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
