import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { statusLabel, statusColor } from '@/lib/yarnCalc';
import PageHeader from '@/components/PageHeader';
import { Pencil, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';
import RowCounterSection from '@/components/RowCounterSection';
import ProjectGaugeSection from '@/components/ProjectGaugeSection';

export default function ProjectDetail() {
  const { id } = useParams();
  const pid = Number(id);
  const project = useLiveQuery(() => db.projects.get(pid), [pid]);

  const yarnLinks = useLiveQuery(() => db.projectYarns.where('projectId').equals(pid).toArray(), [pid]) || [];
  const patternLinks = useLiveQuery(() => db.projectPatterns.where('projectId').equals(pid).toArray(), [pid]) || [];
  const needleLinks = useLiveQuery(() => db.projectNeedles.where('projectId').equals(pid).toArray(), [pid]) || [];
  const notionLinks = useLiveQuery(() => db.projectNotions.where('projectId').equals(pid).toArray(), [pid]) || [];

  const yarns = useLiveQuery(() => db.yarns.toArray(), []) || [];
  const patterns = useLiveQuery(() => db.patterns.toArray(), []) || [];
  const needles = useLiveQuery(() => db.needles.toArray(), []) || [];
  const notions = useLiveQuery(() => db.notions.toArray(), []) || [];

  const yarnMap = new Map(yarns.map(y => [y.id!, y]));
  const patternMap = new Map(patterns.map(p => [p.id!, p]));
  const needleMap = new Map(needles.map(n => [n.id!, n]));
  const notionMap = new Map(notions.map(n => [n.id!, n]));

  const [lightbox, setLightbox] = useState<string | null>(null);

  if (!project) return <p className="p-8 text-center text-sm text-muted-foreground">불러오는 중…</p>;
  if (project.isDeleted) {
    return (
      <div className="space-y-3">
        <PageHeader title="삭제된 프로젝트" back />
        <p className="card-soft p-8 text-center text-sm text-muted-foreground">
          이 프로젝트는 삭제된 상태입니다. 목록에서는 보이지 않아요.
        </p>
      </div>
    );
  }

  const photos = project.photos || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={project.name}
        back
        right={
          <Link to={`/projects/${pid}/edit`} className="btn-soft btn-sm">
            <Pencil className="h-3.5 w-3.5" /> 수정
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
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

      <RowCounterSection projectId={pid} />

      <ProjectGaugeSection projectId={pid} />

      <Section title="도안">
        {patternLinks.length === 0 ? (
          <Empty text="연결된 도안이 없습니다." />
        ) : (
          <ul className="space-y-2">
            {patternLinks.map(l => {
              const p = patternMap.get(l.patternId);
              const deleted = !!p?.isDeleted;
              return (
                <li key={l.id}>
                  <MaybeLink
                    to={`/library/patterns/${l.patternId}/edit`}
                    isDeleted={deleted}
                    className="card-soft flex items-center gap-3 p-3"
                  >
                    <Thumb src={p?.imageDataUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`truncate text-sm font-medium ${deleted ? 'text-muted-foreground line-through' : 'text-ink'}`}>
                          {p?.name || '도안'}
                        </div>
                        {deleted && <DeletedBadge label="도안" />}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {[p?.designer, p?.difficulty].filter(Boolean).join(' · ')}
                      </div>
                      {l.note && <div className="mt-0.5 text-xs text-muted-foreground">메모: {l.note}</div>}
                    </div>
                  </MaybeLink>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="사용한 실">
        {yarnLinks.length === 0 ? (
          <Empty text="연결된 실이 없습니다." />
        ) : (
          <ul className="space-y-2">
            {yarnLinks.map(l => {
              const y = yarnMap.get(l.yarnId);
              const deleted = !!y?.isDeleted;
              return (
                <li key={l.id}>
                  <MaybeLink
                    to={`/library/yarns/${l.yarnId}`}
                    isDeleted={deleted}
                    className="card-soft flex items-center gap-3 p-3"
                  >
                    <Thumb src={y?.photoDataUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`truncate text-sm font-medium ${deleted ? 'text-muted-foreground line-through' : 'text-ink'}`}>
                          {y?.name || '실'}
                        </div>
                        {deleted && <DeletedBadge label="실" />}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">{y?.brand} {y?.colorName && `· ${y.colorName}`}</div>
                      {l.colorNote && <div className="mt-0.5 text-xs text-muted-foreground">메모: {l.colorNote}</div>}
                    </div>
                    <div className={`text-sm font-semibold ${deleted ? 'text-muted-foreground' : 'text-primary'}`}>{l.usedGrams}g</div>
                  </MaybeLink>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="바늘">
        {needleLinks.length === 0 ? (
          <Empty text="연결된 바늘이 없습니다." />
        ) : (
          <ul className="space-y-2">
            {needleLinks.map(l => {
              const n = needleMap.get(l.needleId);
              const deleted = !!n?.isDeleted;
              return (
                <li key={l.id}>
                  <MaybeLink
                    to={`/library/needles/${l.needleId}/edit`}
                    isDeleted={deleted}
                    className="card-soft block p-3"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`text-sm font-medium ${deleted ? 'text-muted-foreground line-through' : 'text-ink'}`}>
                        {n?.type} {n?.sizeMm && `· ${n.sizeMm}`}
                      </div>
                      {deleted && <DeletedBadge label="바늘" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {[n?.brand, n?.material, n?.length].filter(Boolean).join(' · ')}
                    </div>
                    {l.note && <div className="mt-0.5 text-xs text-muted-foreground">메모: {l.note}</div>}
                  </MaybeLink>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="부자재">
        {notionLinks.length === 0 ? (
          <Empty text="연결된 부자재가 없습니다." />
        ) : (
          <ul className="space-y-2">
            {notionLinks.map(l => {
              const n = notionMap.get(l.notionId);
              const deleted = !!n?.isDeleted;
              return (
                <li key={l.id}>
                  <MaybeLink
                    to={`/library/notions/${l.notionId}/edit`}
                    isDeleted={deleted}
                    className="card-soft flex items-center gap-3 p-3"
                  >
                    <Thumb src={n?.photoDataUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`truncate text-sm font-medium ${deleted ? 'text-muted-foreground line-through' : 'text-ink'}`}>
                          {n?.name}
                        </div>
                        {deleted && <DeletedBadge label="부자재" />}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">{[n?.kind, n?.shop].filter(Boolean).join(' · ')}</div>
                      {l.note && <div className="mt-0.5 text-xs text-muted-foreground">메모: {l.note}</div>}
                    </div>
                    {typeof l.quantity === 'number' && <div className={`text-sm font-semibold ${deleted ? 'text-muted-foreground' : 'text-primary'}`}>{l.quantity}개</div>}
                  </MaybeLink>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {photos.filter((p: any) => !p.isDeleted).length > 0 && (
        <Section title="사진">
          <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
            ※ 사진은 이 기기에만 저장됩니다. 무료 백업에는 포함되지 않아요.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {photos
              .filter((p: any) => !p.isDeleted)
              .map((p: any, i: number) => (
                <button
                  key={p.cloudId || i}
                  onClick={() => p.dataUrl && setLightbox(p.dataUrl)}
                  disabled={!p.dataUrl}
                  className="aspect-square overflow-hidden rounded-xl border bg-muted disabled:cursor-default"
                >
                  {p.dataUrl ? (
                    <img src={p.dataUrl} alt={`사진 ${i + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                </button>
              ))}
          </div>
        </Section>
      )}

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

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="확대 보기" className="max-h-full max-w-full rounded-2xl" />
        </div>
      )}
    </div>
  );
}

function Thumb({ src }: { src?: string }) {
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-secondary/60 px-3 py-4 text-center text-[12px] text-muted-foreground">{text}</p>;
}

function MaybeLink({
  to,
  isDeleted,
  className,
  children,
}: {
  to: string;
  isDeleted: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  // 삭제된 항목은 클릭 비활성, dim 스타일
  if (isDeleted) {
    return (
      <div
        className={`${className ?? ''} cursor-default opacity-60`}
        aria-disabled="true"
      >
        {children}
      </div>
    );
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

function DeletedBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
      삭제된 {label}
    </span>
  );
}

