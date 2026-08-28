import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { useConfirm } from '@/hooks/useConfirm';
import { useGoBack } from '@/hooks/useGoBack';
import { ImageInput } from '@/components/ImageInput';
import ReverseProjectsSection from '@/components/ReverseProjectsSection';
import PatternFileInput, { EMPTY_PENDING, type PendingFiles } from '@/components/PatternFileInput';
import { deletePatternFileById, savePatternFile, saveErrorMessage } from '@/lib/patternFile';
import GaugeRowsInput from '@/components/GaugeRowsInput';
import { toGaugeRows, fromGaugeRows, type GaugeRow } from '@/lib/gauge';
import { Save, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

export default function PatternForm() {
  const { id } = useParams();
  const pid = id ? Number(id) : undefined;
  const editing = !!pid;
  const nav = useNavigate();
  const goBack = useGoBack();
  const { confirm, dialog } = useConfirm();
  const existing = useLiveQuery(() => (pid ? db.patterns.get(pid) : undefined), [pid]);

  const [f, setF] = useState({ name: '', designer: '', source: '', link: '', difficulty: '', sizeInfo: '', note: '' });
  const [image, setImage] = useState<string | undefined>(undefined);
  const [hyd, setHyd] = useState(false);
  // 도안 PDF 는 patterns 표가 아니라 patternFiles 에 따로 있다.
  // 목록을 그릴 때마다 몇 MB 를 읽지 않으려고 갈라 두었다.
  const savedFiles = useLiveQuery(
    async () => {
      if (!pid) return [];
      const rows = await db.patternFiles.where('patternId').equals(pid).toArray();
      return rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt - b.createdAt);
    },
    [pid],
  ) || [];
  const [pendingFiles, setPendingFiles] = useState<PendingFiles>(EMPTY_PENDING);
  // 도안이 요구하는 게이지. 실과 같은 모양이라 같은 부품을 쓴다.
  const [gauges, setGauges] = useState<GaugeRow[]>([]);
  useEffect(() => {
    if (editing && existing && !hyd) {
      setF({
        name: existing.name, designer: existing.designer || '', source: existing.source || '',
        link: existing.link || '', difficulty: existing.difficulty || '', sizeInfo: existing.sizeInfo || '', note: existing.note || ''
      });
      setImage(existing.imageDataUrl);
      setGauges(toGaugeRows(existing.gauges));
      setHyd(true);
    }
  }, [editing, existing, hyd]);

  // 삭제된 항목의 수정 화면으로 (뒤로가기 등으로) 진입하면 목록으로 되돌린다
  useEffect(() => {
    if (editing && existing?.isDeleted) {
      nav('/library/patterns', { replace: true });
    }
  }, [editing, existing, nav]);

  async function save() {
    if (!f.name.trim()) {
      toast.error('도안명을 입력해 주세요.');
      return;
    }
    const t = now();
    
    // 공통 업데이트 필드
    const payload = { 
      ...f, 
      imageDataUrl: image,
      gauges: fromGaugeRows(gauges), 
      updatedAt: t,
      isDeleted: false,
      deletedAt: null
    };
    
    let targetId: number;
    if (editing && pid) {
      await db.patterns.update(pid, payload);
      targetId = pid;
    } else {
      targetId = (await db.patterns.add({
        ...payload,
        createdAt: t,
        cloudId: crypto.randomUUID()
      })) as number;
    }

    // PDF 는 도안이 저장돼 id 가 생긴 뒤에 붙인다. 빼기를 먼저 해야 자리가 난다.
    // 파일 저장이 실패해도 도안 자체는 이미 저장됐다 — 알리기만 하고 넘어간다.
    for (const id of pendingFiles.removed) await deletePatternFileById(id);
    for (const f of pendingFiles.added) {
      const r = await savePatternFile(targetId, f);
      if (!r.ok) {
        const m = saveErrorMessage(r.error ?? 'unknown');
        toast.error(m.title, { description: m.description });
      }
    }

    goBack('/library/patterns');
  }
  async function remove() {
    if (!pid) return;
    const ok = await confirm({
      title: '이 도안을 삭제할까요?',
      description: '프로젝트에 연결된 사용 기록은 그대로 남아요. 휴지통에서 되돌릴 수 있어요.',
      confirmLabel: '삭제',
    });
    if (!ok) return;
    const t = Date.now();
    await db.patterns.update(pid, {
      isDeleted: true,
      deletedAt: t,
      updatedAt: t,
    } as any);
    goBack('/library/patterns');
    toast.success('도안을 삭제했어요', {
      duration: 8000,
      action: {
        label: '되돌리기',
        onClick: async () => {
          const n = Date.now();
          await db.patterns.update(pid, {
            isDeleted: false,
            deletedAt: null,
            updatedAt: n,
          } as any);
          toast.success('도안을 다시 살렸어요');
        },
      },
    });
  }
  const u = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <PageHeader title={editing ? '도안 수정' : '새 도안'} back />
      {dialog}
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
      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">도안 파일 (PDF)</span>
        <PatternFileInput
          saved={savedFiles}
          pending={pendingFiles}
          onPending={setPendingFiles}
          rememberKey={pid ? String(pid) : undefined}
        />
      </div>
      <Field label="사이즈 정보"><input className={inp} value={f.sizeInfo} onChange={u('sizeInfo')} /></Field>
      <GaugeRowsInput
        rows={gauges}
        onChange={setGauges}
        hint="도안이 요구하는 게이지예요. 적어두면 가진 실의 게이지로 도안을 찾을 수 있어요."
      />
      <Field label="메모"><textarea className={`${inp} min-h-[80px]`} value={f.note} onChange={u('note')} /></Field>
      {editing && <ReverseProjectsSection kind="pattern" refId={pid} />}
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
    <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
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
