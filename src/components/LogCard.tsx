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
    // 프로젝트명 · 기분 · 글 · 사진 순으로 한 줄에 늘어놓는다.
    // 사진은 맨 오른쪽 — 왼쪽 끝을 글이 차지해야 목록을 훑을 때 눈이 편하다.
    <Link to={`/diary/${log.id}/edit`} className="card-soft block p-3.5 transition active:scale-[0.995]">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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

          <div className="flex items-start gap-2">
            {log.mood && <span className="text-[16px] leading-none">{log.mood}</span>}
            <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{log.text}</p>
          </div>
        </div>

        {/* 사진이 없으면 자리를 비운다 — 빈 칸을 뭔가로 채우면 오히려 눈에 걸린다 */}
        {urls.length > 0 && (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
            <img src={urls[0]} alt="" className="h-full w-full object-cover" />
            {urls.length > 1 && (
              // 나머지는 눌러 들어가면 다 볼 수 있으니 장수만 알려준다
              <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/55 px-1.5 text-[10px] font-bold leading-[15px] text-white">
                +{urls.length - 1}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
