import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { statusLabel, statusColor } from '@/lib/yarnCalc';
import { describeNeedle } from '@/lib/needleType';
import PageHeader from '@/components/PageHeader';
import { Pencil, Image as ImageIcon, PenLine } from 'lucide-react';
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
  const logs = useLiveQuery(
    () => db.logs.where('projectId').equals(pid).filter(l => !l.isDeleted).toArray(),
    [pid],
  ) || [];

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
  const livePhotos = photos.filter((p: any) => !p.isDeleted);
  // 맨 위 카드에 쓸 대표 사진 — 아직 내려받는 중이면 dataUrl 이 없을 수 있다
  const cover = livePhotos.find((p: any) => p.dataUrl);
  // 대표 정보 옆에 곁들일 최근 기록. 전체는 다이어리에서 본다.
  const recentLogs = [...logs]
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
    .slice(0, 4);

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
      {/* Hero — 상태·일자 아래에 대표 사진과 사이즈·게이지를 나란히 둔다.
          사진이 맨 위에 있어야 어떤 프로젝트인지 한눈에 들어온다는 의견 반영. */}
      <div className="card-soft overflow-hidden bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
          <span className={`chip ${statusColor(project.status)}`}>{statusLabel(project.status)}</span>
          {project.startDate && (
            <span className="text-[11.5px] text-muted-foreground">시작 {project.startDate}</span>
          )}
          {project.endDate && (
            <span className="text-[11.5px] text-muted-foreground">완료 {project.endDate}</span>
          )}
        </div>
        <div className="grid gap-3.5 px-4 py-3.5 sm:grid-cols-2 sm:gap-5">
          {(cover || project.size || project.gauge) && (
            <div className="flex gap-3.5">
              {cover?.dataUrl && (
                <button
                  type="button"
                  onClick={() => setLightbox(cover.dataUrl)}
                  className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl border bg-muted"
                >
                  <img src={cover.dataUrl} alt="대표 사진" className="h-full w-full object-cover" />
                </button>
              )}
              <dl className="flex min-w-0 flex-1 flex-col justify-center gap-2.5 text-[12.5px]">
                {project.size && (
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">사이즈</dt>
                    <dd className="mt-0.5 truncate font-semibold text-foreground">{project.size}</dd>
                  </div>
                )}
                {project.gauge && (
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">게이지</dt>
                    <dd className="mt-0.5 truncate font-semibold text-foreground">{project.gauge}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* 다이어리 요약 — 대표 정보 옆의 빈 자리를 쓴다.
              여기서는 사진 없이 날짜와 글 한 줄만. 전체는 다이어리에서 본다. */}
          <div className="min-w-0 border-t border-border/60 pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="section-title px-0">다이어리</h2>
              {logs.length > 0 && (
                <Link to={`/diary?projectId=${pid}`} className="text-[11px] font-semibold text-primary underline underline-offset-2">
                  더보기
                </Link>
              )}
            </div>
            {logs.length === 0 ? (
              <Link
                to={`/diary/new?projectId=${pid}`}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 py-2.5 text-[12px] font-semibold text-primary"
              >
                <PenLine className="h-3.5 w-3.5" /> 첫 기록 남기기
              </Link>
            ) : (
              <ul className="space-y-1.5">
                {recentLogs.map(l => (
                  <li key={l.id}>
                    <Link to={`/diary/${l.id}/edit`} className="flex items-baseline gap-2">
                      <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">{l.date}</span>
                      {l.mood && <span className="shrink-0 text-[13px] leading-none">{l.mood}</span>}
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{l.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* 완성 소감은 다 만든 뒤에 쓰는 글이라 완성일 때만 내놓는다 */}
      {project.status === 'done' && project.finishedNote && (
        <Section title="완성 소감">
          <div className="card-soft whitespace-pre-wrap rounded-r-2xl border-l-4 border-accent/40 bg-accent-soft/30 px-4 py-3.5 text-[13px] leading-relaxed text-ink">
            {project.finishedNote}
          </div>
        </Section>
      )}

      {/* 정해두고 잘 안 바뀌는 것들 — 한 줄에 둘씩 눌러 담는다.
          내용이 없는 칸은 아예 안 나오고, 추가는 수정 화면에서 한다. */}
      <div className="grid grid-cols-2 items-start gap-x-3 gap-y-4">
        {patternLinks.length > 0 && (
          <MiniSection title="도안">
            {patternLinks.map(l => {
              const p = patternMap.get(l.patternId);
              const deleted = !!p?.isDeleted;
              return (
                <MaybeLink
                  key={l.id}
                  to={`/library/patterns/${l.patternId}/edit`}
                  isDeleted={deleted}
                  className="card-soft flex items-center gap-2 p-2"
                >
                  <Thumb src={p?.imageDataUrl} />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[12.5px] font-medium ${deleted ? 'text-muted-foreground line-through' : 'text-ink'}`}>
                      {p?.name || '도안'}
                    </div>
                    <div className="truncate text-[10.5px] text-muted-foreground">
                      {deleted ? '삭제됨' : [p?.designer, p?.difficulty].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                </MaybeLink>
              );
            })}
          </MiniSection>
        )}

        {yarnLinks.length > 0 && (
          <MiniSection title="사용한 실">
            {yarnLinks.map(l => {
              const y = yarnMap.get(l.yarnId);
              const deleted = !!y?.isDeleted;
              return (
                <MaybeLink
                  key={l.id}
                  to={`/library/yarns/${l.yarnId}`}
                  isDeleted={deleted}
                  className="card-soft flex items-center gap-2 p-2"
                >
                  <Thumb src={y?.photoDataUrl} />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[12.5px] font-medium ${deleted ? 'text-muted-foreground line-through' : 'text-ink'}`}>
                      {y?.name || '실'}
                    </div>
                    <div className="truncate text-[10.5px] text-muted-foreground">
                      {[y?.colorName, `${l.usedGrams}g`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </MaybeLink>
              );
            })}
          </MiniSection>
        )}

        {/* 바늘은 사진이 없어 줄글로 넣는다 — 여러 개여도 답답하지 않다 */}
        {needleLinks.length > 0 && (
          <MiniSection title="바늘">
            {needleLinks.map(l => {
              const n = needleMap.get(l.needleId);
              const deleted = !!n?.isDeleted;
              return (
                <MaybeLink
                  key={l.id}
                  to={`/library/needles/${l.needleId}/edit`}
                  isDeleted={deleted}
                  className="card-soft block px-2.5 py-2"
                >
                  <div className={`truncate text-[12.5px] font-medium ${deleted ? 'text-muted-foreground line-through' : 'text-ink'}`}>
                    {describeNeedle(n || {})}{n?.sizeMm && ` · ${n.sizeMm}`}
                  </div>
                  <div className="truncate text-[10.5px] text-muted-foreground">
                    {deleted ? '삭제됨' : [n?.brand, n?.material, n?.length].filter(Boolean).join(' · ') || '—'}
                  </div>
                </MaybeLink>
              );
            })}
          </MiniSection>
        )}

        {notionLinks.length > 0 && (
          <MiniSection title="부자재">
            {notionLinks.map(l => {
              const n = notionMap.get(l.notionId);
              const deleted = !!n?.isDeleted;
              return (
                <MaybeLink
                  key={l.id}
                  to={`/library/notions/${l.notionId}/edit`}
                  isDeleted={deleted}
                  className="card-soft flex items-center gap-2 p-2"
                >
                  <Thumb src={n?.photoDataUrl} />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[12.5px] font-medium ${deleted ? 'text-muted-foreground line-through' : 'text-ink'}`}>
                      {n?.name}
                    </div>
                    <div className="truncate text-[10.5px] text-muted-foreground">
                      {[n?.kind, typeof l.quantity === 'number' ? `${l.quantity}개` : null].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                </MaybeLink>
              );
            })}
          </MiniSection>
        )}
      </div>

      {/* 뜨면서 쓰는 도구는 맨 아래. 안 쓰면 아예 안 나온다. */}
      <RowCounterSection projectId={pid} mode="view" />

      <ProjectGaugeSection projectId={pid} mode="view" />

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

/** 한 줄에 둘씩 들어가는 좁은 칸 — 제목이 작고 사이가 촘촘하다 */
function MiniSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 space-y-1.5">
      <h2 className="section-title">{title}</h2>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Thumb({ src }: { src?: string }) {
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-muted">
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

