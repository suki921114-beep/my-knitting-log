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
    // 사진 · 기분 · 글을 한 줄에 나란히 둔다.
    // 사진이 아래로 내려가 있으면 목록에서 그날이 어땠는지 한눈에 안 들어온다.
    <Link to={`/diary/${log.id}/edit`} className="card-soft block p-3.5 transition active:scale-[0.995]">
      <div className="flex items-start gap-3">
        {urls.length > 0 && (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
            <img src={urls[0]} alt="" className="h-full w-full object-cover" />
            {urls.length > 1 && (
              // 나머지는 눌러 들어가면 다 볼 수 있으니 장수만 알려준다
              <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/55 px-1.5 text-[10px] font-bold leading-[15px] text-white">
                +{urls.length - 1}
              </span>
            )}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start gap-2">
            {log.mood && <span className="text-[16px] leading-none">{log.mood}</span>}
            <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{log.text}</p>
          </div>

          {((showProject && projectName) || log.rows != null) && (
            <div className="flex flex-wrap items-center gap-1.5">
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
          )}
        </div>
      </div>
    </Link>
  );
}
