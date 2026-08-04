import { Link } from 'react-router-dom';
import { KnitLog } from '@/lib/db';
import { photoUrls } from '@/lib/photo';

/**
 * 기록 한 편. 다이어리와 프로젝트 상세에서 같은 카드를 쓴다.
 * showProject 가 true 면 어느 프로젝트 기록인지 태그를 붙인다 (다이어리용).
 */
export default function LogCard({
  log,
  projectName,
  showProject = false,
}: {
  log: KnitLog;
  projectName?: string;
  showProject?: boolean;
}) {
  const urls = photoUrls(log.photos);

  return (
    <Link to={`/diary/${log.id}/edit`} className="card-soft block p-3.5 transition active:scale-[0.995]">
      <div className="flex items-start gap-2">
        {log.mood && <span className="text-[16px] leading-none">{log.mood}</span>}
        <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{log.text}</p>
      </div>

      {urls.length > 0 && (
        <div className="mt-2.5 flex gap-1.5">
          {urls.slice(0, 4).map((u, i) => (
            <div key={i} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
              <img src={u} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {(showProject && projectName) || log.rows != null ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {showProject && projectName && (
            <span className="max-w-[190px] truncate rounded-full bg-primary-soft px-2 py-0.5 text-[10.5px] font-semibold text-primary">
              {projectName}
            </span>
          )}
          {log.rows != null && (
            <span className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-muted-foreground">
              {log.rows}단
            </span>
          )}
        </div>
      ) : null}
    </Link>
  );
}
