import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ProjectPhoto } from '@/lib/db';
import { saveLog, deleteLog, todayStr } from '@/lib/logs';
import { photoUrls } from '@/lib/photo';
import PageHeader from '@/components/PageHeader';
import { MultiImageInput } from '@/components/ImageInput';
import { useConfirm } from '@/hooks/useConfirm';
import { toast } from '@/components/ui/sonner';
import { Save, Trash2 } from 'lucide-react';

const MOODS = ['🧶', '😊', '🔥', '😮‍💨', '😴', '🎉'];

function reconcilePhotos(prev: ProjectPhoto[], urls: string[]): ProjectPhoto[] {
  const byUrl = new Map<string, ProjectPhoto>();
  for (const p of prev) {
    if (p.dataUrl && !p.isDeleted) byUrl.set(p.dataUrl, p);
  }
  const t = Date.now();
  return urls.map(url => {
    const found = byUrl.get(url);
    if (found) return found;
    return {
      cloudId: crypto.randomUUID(),
      dataUrl: url,
      contentType: url.match(/^data:([^;]+);/)?.[1] ?? 'image/jpeg',
      createdAt: t,
      updatedAt: t,
      isDeleted: false,
      deletedAt: null,
    };
  });
}

export default function LogForm() {
  const { id } = useParams();
  const logId = id ? Number(id) : undefined;
  const editing = !!logId;
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { confirm, dialog } = useConfirm();

  const existing = useLiveQuery(() => (logId ? db.logs.get(logId) : undefined), [logId]);
  const projects = useLiveQuery(
    () => db.projects.filter(p => !p.isDeleted).reverse().sortBy('updatedAt'),
    [],
  ) || [];

  // 달력에서 특정 날짜를 고르고 왔으면 그 날짜로 시작
  const [date, setDate] = useState(() => {
    const q = params.get('date');
    return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayStr();
  });
  const [text, setText] = useState('');
  const [rows, setRows] = useState<string>('');
  const [mood, setMood] = useState<string | undefined>(undefined);
  const [projectId, setProjectId] = useState<number | undefined>(
    params.get('projectId') ? Number(params.get('projectId')) : undefined,
  );
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [hyd, setHyd] = useState(false);

  useEffect(() => {
    if (editing && existing && !hyd) {
      setDate(existing.date);
      setText(existing.text);
      setRows(existing.rows != null ? String(existing.rows) : '');
      setMood(existing.mood);
      setProjectId(existing.projectId);
      setPhotos((existing.photos as ProjectPhoto[]) || []);
      setHyd(true);
    }
  }, [editing, existing, hyd]);

  useEffect(() => {
    if (editing && existing?.isDeleted) nav('/diary', { replace: true });
  }, [editing, existing, nav]);

  const urls = useMemo(() => photoUrls(photos), [photos]);

  async function save() {
    if (!text.trim()) {
      toast.error('오늘 뭘 떴는지 한 줄만 적어 주세요');
      return;
    }
    await saveLog({
      id: logId,
      projectId,
      date,
      text,
      rows: rows.trim() ? Number(rows) || undefined : undefined,
      mood,
      photos,
    });
    toast.success(editing ? '기록을 수정했어요' : '기록을 남겼어요');
    nav(-1);
  }

  async function remove() {
    if (!logId) return;
    const ok = await confirm({
      title: '이 기록을 삭제할까요?',
      description: '휴지통에서 되돌릴 수 있어요.',
      confirmLabel: '삭제',
    });
    if (!ok) return;
    await deleteLog(logId);
    toast.success('기록을 삭제했어요');
    nav('/diary', { replace: true });
  }

  return (
    <div className="space-y-4">
      <PageHeader title={editing ? '기록 수정' : '오늘의 기록'} back />
      {dialog}

      <Field label="날짜">
        <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} />
      </Field>

      <Field label="무엇을 떴나요?">
        <textarea
          autoFocus={!editing}
          className={`${inp} min-h-[132px] resize-y leading-relaxed`}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="오늘은 소매까지 완성! 코가 자꾸 빠져서 애먹었다."
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="오늘 뜬 단수">
          <input
            type="number"
            inputMode="numeric"
            className={inp}
            value={rows}
            onChange={e => setRows(e.target.value)}
            placeholder="선택"
          />
        </Field>
        <Field label="기분">
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMood(mood === m ? undefined : m)}
                className={`h-9 w-9 rounded-full text-[17px] transition ${
                  mood === m ? 'bg-primary/15 ring-2 ring-primary/50' : 'bg-secondary/60'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <FieldDiv label="연결할 프로젝트">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setProjectId(undefined)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              projectId === undefined
                ? 'border-primary bg-primary/10 font-medium text-primary'
                : 'border-border text-muted-foreground'
            }`}
          >
            연결 안 함
          </button>
          {projects.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProjectId(p.id)}
              className={`max-w-[180px] truncate rounded-full border px-3 py-1.5 text-xs transition ${
                projectId === p.id
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </FieldDiv>

      <FieldDiv label="사진">
        <MultiImageInput values={urls} onChange={next => setPhotos(reconcilePhotos(photos, next))} max={4} />
      </FieldDiv>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2">
          {editing && (
            <button
              type="button"
              onClick={remove}
              className="rounded-full border border-destructive/30 px-4 py-2.5 text-sm text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={save}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-soft"
          >
            <Save className="h-4 w-4" /> 저장
          </button>
        </div>
      </div>
    </div>
  );
}

const inp = 'w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
/** 내부에 버튼이 들어가는 필드 — label 중첩 클릭 문제 회피 */
function FieldDiv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
