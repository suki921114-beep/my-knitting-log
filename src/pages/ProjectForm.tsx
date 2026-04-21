import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now, Project, ProjectStatus, Yarn } from '@/lib/db';
import { statusLabel } from '@/lib/yarnCalc';
import PageHeader from '@/components/PageHeader';
import PrivacyNote from '@/components/PrivacyNote';
import YarnPicker, { YarnLink } from '@/components/YarnPicker';
import { Save, Trash2 } from 'lucide-react';

const STATUSES: ProjectStatus[] = ['planned', 'in_progress', 'done', 'on_hold'];

export default function ProjectForm() {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const projectId = id ? Number(id) : undefined;

  const existing = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId]);
  const existingLinks = useLiveQuery(
    () => (projectId ? db.projectYarns.where('projectId').equals(projectId).toArray() : []),
    [projectId]
  );

  const [name, setName] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planned');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [size, setSize] = useState('');
  const [gauge, setGauge] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [finishedNote, setFinishedNote] = useState('');
  const [yarnLinks, setYarnLinks] = useState<YarnLink[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (editing && existing && !hydrated) {
      setName(existing.name);
      setStatus(existing.status);
      setStartDate(existing.startDate || '');
      setEndDate(existing.endDate || '');
      setSize(existing.size || '');
      setGauge(existing.gauge || '');
      setProgressNote(existing.progressNote || '');
      setFinishedNote(existing.finishedNote || '');
      setHydrated(true);
    }
  }, [editing, existing, hydrated]);

  useEffect(() => {
    if (editing && existingLinks && !yarnLinks.length && existingLinks.length) {
      setYarnLinks(
        existingLinks.map(l => ({
          id: l.id,
          yarnId: l.yarnId,
          usedGrams: l.usedGrams,
          colorNote: l.colorNote || '',
          usageNote: l.usageNote || '',
        }))
      );
    }
  }, [editing, existingLinks]); // eslint-disable-line

  async function save() {
    if (!name.trim()) {
      alert('프로젝트명을 입력해 주세요.');
      return;
    }
    const t = now();
    let pid = projectId;
    if (editing && pid) {
      await db.projects.update(pid, {
        name: name.trim(),
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        size: size || undefined,
        gauge: gauge || undefined,
        progressNote: progressNote || undefined,
        finishedNote: finishedNote || undefined,
        updatedAt: t,
      });
    } else {
      pid = (await db.projects.add({
        name: name.trim(),
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        size: size || undefined,
        gauge: gauge || undefined,
        progressNote: progressNote || undefined,
        finishedNote: finishedNote || undefined,
        createdAt: t,
        updatedAt: t,
      })) as number;
    }

    // sync yarn links
    const oldIds = (existingLinks || []).map(l => l.id!);
    const keptIds = yarnLinks.filter(l => l.id).map(l => l.id!);
    const toDelete = oldIds.filter(i => !keptIds.includes(i));
    if (toDelete.length) await db.projectYarns.bulkDelete(toDelete);
    for (const l of yarnLinks) {
      if (l.id) {
        await db.projectYarns.update(l.id, {
          usedGrams: l.usedGrams,
          colorNote: l.colorNote || undefined,
          usageNote: l.usageNote || undefined,
          updatedAt: t,
        });
      } else {
        await db.projectYarns.add({
          projectId: pid!,
          yarnId: l.yarnId,
          usedGrams: l.usedGrams,
          colorNote: l.colorNote || undefined,
          usageNote: l.usageNote || undefined,
          createdAt: t,
          updatedAt: t,
        });
      }
    }
    nav(`/projects/${pid}`);
  }

  async function remove() {
    if (!projectId) return;
    if (!confirm('이 프로젝트를 삭제할까요? 사용한 실 기록도 함께 사라집니다.')) return;
    await db.projectYarns.where('projectId').equals(projectId).delete();
    await db.projects.delete(projectId);
    nav('/projects');
  }

  return (
    <div className="space-y-5">
      <PageHeader title={editing ? '프로젝트 수정' : '새 프로젝트'} back />

      <Field label="프로젝트명">
        <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="예: 가을 카디건" />
      </Field>

      <Field label="상태">
        <div className="grid grid-cols-4 gap-1.5">
          {STATUSES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${
                status === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
              }`}
            >
              {statusLabel(s)}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="시작일"><input type="date" className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} /></Field>
        <Field label="완료일"><input type="date" className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="사이즈"><input className={inputCls} value={size} onChange={e => setSize(e.target.value)} placeholder="M / 90cm" /></Field>
        <Field label="게이지"><input className={inputCls} value={gauge} onChange={e => setGauge(e.target.value)} placeholder="22코 28단/10cm" /></Field>
      </div>

      <Field label="사용한 실">
        <YarnPicker links={yarnLinks} onChange={setYarnLinks} />
      </Field>

      <Field label="진행 메모">
        <textarea className={`${inputCls} min-h-[88px] resize-y`} value={progressNote} onChange={e => setProgressNote(e.target.value)} placeholder="오늘은 소매까지 완성!" />
      </Field>

      <Field label="완성 소감">
        <textarea className={`${inputCls} min-h-[64px] resize-y`} value={finishedNote} onChange={e => setFinishedNote(e.target.value)} placeholder="다 만들고 나면 적어보세요." />
      </Field>

      <PrivacyNote kind="memo" />

      <div className="sticky bottom-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2">
          {editing && (
            <button onClick={remove} className="inline-flex items-center justify-center rounded-full border border-destructive/30 px-4 py-2.5 text-sm text-destructive">
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

const inputCls = 'w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
