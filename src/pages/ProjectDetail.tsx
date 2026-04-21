import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { statusLabel, statusColor } from '@/lib/yarnCalc';
import PageHeader from '@/components/PageHeader';
import { Pencil } from 'lucide-react';

export default function ProjectDetail() {
  const { id } = useParams();
  const pid = Number(id);
  const nav = useNavigate();
  const project = useLiveQuery(() => db.projects.get(pid), [pid]);
  const links = useLiveQuery(() => db.projectYarns.where('projectId').equals(pid).toArray(), [pid]) || [];
  const yarns = useLiveQuery(() => db.yarns.toArray(), []) || [];
  const yarnMap = new Map(yarns.map(y => [y.id!, y]));

  if (!project) return <p className="p-8 text-center text-sm text-muted-foreground">불러오는 중…</p>;

  return (
    <div className="space-y-5">
      <PageHeader
        title={project.name}
        back
        right={
          <Link to={`/projects/${pid}/edit`} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">
            <Pencil className="inline h-3.5 w-3.5" /> 수정
          </Link>
        }
      />
      <div className="flex items-center gap-2">
        <span className={`chip ${statusColor(project.status)}`}>{statusLabel(project.status)}</span>
        {project.startDate && <span className="text-xs text-muted-foreground">시작 {project.startDate}</span>}
        {project.endDate && <span className="text-xs text-muted-foreground">완료 {project.endDate}</span>}
      </div>

      {(project.size || project.gauge) && (
        <div className="card-soft p-4 text-sm">
          {project.size && <div><span className="text-muted-foreground">사이즈 </span>{project.size}</div>}
          {project.gauge && <div><span className="text-muted-foreground">게이지 </span>{project.gauge}</div>}
        </div>
      )}

      <Section title="사용한 실">
        {links.length === 0 ? (
          <p className="rounded-xl bg-secondary/50 px-3 py-4 text-center text-xs text-muted-foreground">연결된 실이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {links.map(l => {
              const y = yarnMap.get(l.yarnId);
              return (
                <li key={l.id}>
                  <Link to={`/library/yarns/${l.yarnId}`} className="card-soft flex items-center justify-between p-3">
                    <div>
                      <div className="text-sm font-medium text-ink">{y?.name || '실'}</div>
                      <div className="text-[11px] text-muted-foreground">{y?.brand} {y?.colorName && `· ${y.colorName}`}</div>
                      {l.colorNote && <div className="mt-0.5 text-xs text-muted-foreground">메모: {l.colorNote}</div>}
                    </div>
                    <div className="text-sm font-semibold text-primary">{l.usedGrams}g</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {project.progressNote && (
        <Section title="진행 메모">
          <div className="card-soft whitespace-pre-wrap p-4 text-sm leading-relaxed text-ink">{project.progressNote}</div>
        </Section>
      )}
      {project.finishedNote && (
        <Section title="완성 소감">
          <div className="card-soft whitespace-pre-wrap p-4 text-sm leading-relaxed text-ink">{project.finishedNote}</div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 font-serif text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
