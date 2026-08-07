import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { useConfirm } from '@/hooks/useConfirm';
import ReverseProjectsSection from '@/components/ReverseProjectsSection';
import { Save, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import NeedleTypePicker from '@/components/NeedleTypePicker';
import { readNeedle, writeNeedle, type NeedleShape } from '@/lib/needleType';

export default function NeedleForm() {
  const { id } = useParams();
  const nid = id ? Number(id) : undefined;
  const editing = !!nid;
  const nav = useNavigate();
  const { confirm, dialog } = useConfirm();
  const existing = useLiveQuery(() => (nid ? db.needles.get(nid) : undefined), [nid]);
  const [f, setF] = useState({ sizeMm: '', brand: '', material: '', length: '', note: '' });
  const [shape, setShape] = useState<NeedleShape>({ kind: '대바늘' });
  const [hyd, setHyd] = useState(false);
  useEffect(() => {
    if (editing && existing && !hyd) {
      setF({ sizeMm: existing.sizeMm || '', brand: existing.brand || '', material: existing.material || '', length: existing.length || '', note: existing.note || '' });
      setShape(readNeedle(existing));
      setHyd(true);
    }
  }, [editing, existing, hyd]);

  // 삭제된 항목의 수정 화면으로 (뒤로가기 등으로) 진입하면 목록으로 되돌린다
  useEffect(() => {
    if (editing && existing?.isDeleted) {
      nav('/library/needles', { replace: true });
    }
  }, [editing, existing, nav]);

  async function save() {
    const t = now();
    
    // 공통 업데이트 필드
    const payload = {
      ...f,
      ...writeNeedle(shape),
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
    nav('/library/needles', { replace: true });
  }
  async function remove() {
    if (!nid) return;
    const ok = await confirm({
      title: '이 바늘을 삭제할까요?',
      description: '프로젝트에 연결된 사용 기록은 그대로 남아요. 휴지통에서 되돌릴 수 있어요.',
      confirmLabel: '삭제',
    });
    if (!ok) return;
    const t = Date.now();
    await db.needles.update(nid, {
      isDeleted: true,
      deletedAt: t,
      updatedAt: t,
    } as any);
    nav('/library/needles', { replace: true });
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
      {dialog}
      <FieldDiv label="종류">
        <NeedleTypePicker value={shape} onChange={setShape} />
      </FieldDiv>
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

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
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
/** 안에 버튼이 들어가는 칸 — label 로 감싸면 버튼 클릭이 엉킨다 */
function FieldDiv({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</div>;
}
