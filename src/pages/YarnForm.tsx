import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { ImageInput } from '@/components/ImageInput';
import { toast } from '@/components/ui/sonner';
import { Save, Trash2 } from 'lucide-react';

export default function YarnForm() {
  const { id } = useParams();
  const yid = id ? Number(id) : undefined;
  const editing = !!yid;
  const nav = useNavigate();
  const existing = useLiveQuery(() => (yid ? db.yarns.get(yid) : undefined), [yid]);

  const [f, setF] = useState({
    name: '', brand: '', colorName: '', colorCode: '', shop: '', fiber: '', weight: '', totalGrams: 0, note: '',
  });
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [hyd, setHyd] = useState(false);

  useEffect(() => {
    if (editing && existing && !hyd) {
      setF({
        name: existing.name, brand: existing.brand || '', colorName: existing.colorName || '',
        colorCode: existing.colorCode || '', shop: existing.shop || '', fiber: existing.fiber || '',
        weight: existing.weight || '', totalGrams: existing.totalGrams, note: existing.note || '',
      });
      setPhoto(existing.photoDataUrl);
      setHyd(true);
    }
  }, [editing, existing, hyd]);

  async function save() {
    if (!f.name.trim()) return alert('실 이름을 입력해 주세요.');
    const t = now();
    
    // 공통 업데이트 필드
    const payload = { 
      ...f, 
      photoDataUrl: photo, 
      updatedAt: t,
      isDeleted: false,
      deletedAt: null
    };
    
    if (editing && yid) {
      // 수정 시 기존 createdAt, cloudId는 그대로 유지됨 (update 동작)
      await db.yarns.update(yid, payload);
      nav(`/library/yarns/${yid}`);
    } else {
      // 신규 생성 시 누락된 필수 필드 전부 주입
      const id = (await db.yarns.add({ 
        ...payload, 
        createdAt: t,
        cloudId: crypto.randomUUID()
      })) as number;
      nav(`/library/yarns/${id}`);
    }
  }

  async function remove() {
    if (!yid) return;
    if (!confirm('이 실을 삭제할까요? 프로젝트에 연결된 사용 기록은 그대로 남아요.')) return;
    const t = Date.now();
    // soft delete — 실제 row 는 보존하고 isDeleted 만 켠다.
    // 프로젝트의 연결관계(projectYarns)는 다음 단계에서 cascade 처리 예정이라 지금은 그대로 둔다.
    await db.yarns.update(yid, {
      isDeleted: true,
      deletedAt: t,
      updatedAt: t,
    } as any);
    nav('/library/yarns');
    toast.success('실을 삭제했어요', {
      duration: 8000,
      action: {
        label: '되돌리기',
        onClick: async () => {
          const now = Date.now();
          await db.yarns.update(yid, {
            isDeleted: false,
            deletedAt: null,
            updatedAt: now,
          } as any);
          toast.success('실을 다시 살렸어요');
        },
      },
    });
  }

  const u = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: k === 'totalGrams' ? Number(e.target.value) || 0 : e.target.value });

  return (
    <div className="space-y-4">
      <PageHeader title={editing ? '실 수정' : '새 실'} back />
      <Field label="대표 이미지">
        <ImageInput value={photo} onChange={setPhoto} aspect="square" />
      </Field>
      <Field label="이름 *"><input className={inp} value={f.name} onChange={u('name')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="브랜드"><input className={inp} value={f.brand} onChange={u('brand')} /></Field>
        <Field label="구매처"><input className={inp} value={f.shop} onChange={u('shop')} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="컬러명"><input className={inp} value={f.colorName} onChange={u('colorName')} /></Field>
        <Field label="컬러번호"><input className={inp} value={f.colorCode} onChange={u('colorCode')} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="성분"><input className={inp} value={f.fiber} onChange={u('fiber')} placeholder="울 100%" /></Field>
        <Field label="굵기"><input className={inp} value={f.weight} onChange={u('weight')} placeholder="fingering" /></Field>
      </div>
      <Field label="총 보유량 (g)">
        <input type="number" inputMode="decimal" className={inp} value={f.totalGrams} onChange={u('totalGrams')} />
      </Field>
      <Field label="메모"><textarea className={`${inp} min-h-[72px]`} value={f.note} onChange={u('note')} /></Field>

      <div className="sticky bottom-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2">
          {editing && (
            <button onClick={remove} className="rounded-full border border-destructive/30 px-4 py-2.5 text-sm text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={save} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-soft">
            <Save className="h-4 w-4" /> 저장
          </button>
        </div>
      </div>
    </div>
  );
}

const inp = 'w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
