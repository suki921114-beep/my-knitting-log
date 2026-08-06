import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { photoUrls } from '@/lib/photo';
import { Download, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// ----------------------------------------------------------------------------
// 사진 백업 리마인더
// ----------------------------------------------------------------------------
// 앱 삭제 / 브라우저 저장소 정리 / 기기 교체 시 이 기기의 사진은 그대로 사라진다.
// 사진이 쌓였는데 오래 파일로 내보내지 않았으면 홈에서 한 번 알려 준다.
//
// ⚠️ 로그인 여부에 따라 사정이 다르다.
//    로그인했으면 사진은 이미 클라우드에 올라가 있다. 그런데도 "파일로 내보내야
//    사진을 보관할 수 있다"고 말하면 거짓말이 된다. 이 경우에는 용량 상한(1GB)
//    때문에 한 벌 더 받아두면 좋다는 쪽으로만 권한다.

/** 마지막 JSON 내보내기 시각 (SettingsBackup 의 handleExport 가 기록) */
const LAST_BACKUP_KEY = 'lastBackupAt';
/** 사용자가 "나중에" 를 누른 시각 */
const SNOOZE_KEY = 'backupReminderSnoozedAt';

/** 이 기간이 지나면 다시 알린다 */
const REMIND_AFTER_DAYS = 14;
/** "나중에" 를 누르면 이 기간 동안 조용히 */
const SNOOZE_DAYS = 7;
/** 사진이 이 장수 이상일 때만 알린다 (한두 장은 굳이 재촉하지 않음) */
const MIN_PHOTOS = 3;

const DAY = 24 * 60 * 60 * 1000;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY);
}

export default function BackupReminder() {
  const { user } = useAuth();
  const signedIn = !!user;
  const [dismissed, setDismissed] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [snoozedAt, setSnoozedAt] = useState<string | null>(null);

  useEffect(() => {
    setLastBackup(localStorage.getItem(LAST_BACKUP_KEY));
    setSnoozedAt(localStorage.getItem(SNOOZE_KEY));
  }, []);

  // 로컬에만 있는 사진 개수 (프로젝트 사진 + 라이브러리 대표 이미지)
  const photoCount = useLiveQuery(async () => {
    const projects = await db.projects.filter(p => !p.isDeleted).toArray();
    let n = projects.reduce((acc, p) => acc + photoUrls(p.photos).length, 0);
    n += await db.yarns.filter(y => !y.isDeleted && !!y.photoDataUrl).count();
    n += await db.patterns.filter(p => !p.isDeleted && !!p.imageDataUrl).count();
    n += await db.notions.filter(x => !x.isDeleted && !!x.photoDataUrl).count();
    return n;
  }, []) ?? 0;

  if (dismissed || photoCount < MIN_PHOTOS) return null;

  const snoozedDays = daysSince(snoozedAt);
  if (snoozedDays !== null && snoozedDays < SNOOZE_DAYS) return null;

  const backupDays = daysSince(lastBackup);
  const neverBackedUp = backupDays === null;
  if (!neverBackedUp && backupDays < REMIND_AFTER_DAYS) return null;

  function snooze() {
    localStorage.setItem(SNOOZE_KEY, new Date().toISOString());
    setDismissed(true);
  }

  return (
    <div className="relative rounded-2xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
      <button
        type="button"
        onClick={snooze}
        aria-label="나중에"
        className="absolute right-2 top-2 rounded-full p-1.5 text-amber-700/70 hover:bg-amber-100 dark:text-amber-300/70 dark:hover:bg-amber-900/40"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-200/70 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">
            {signedIn ? '백업 파일도 받아두시겠어요?' : '이 기기에만 저장돼 있어요'} · 사진 {photoCount}장
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-amber-800/90 dark:text-amber-300/80">
            {neverBackedUp
              ? '아직 백업 파일을 저장한 적이 없어요.'
              : `마지막으로 파일을 받은 지 ${backupDays}일 됐어요.`}{' '}
            {signedIn
              ? '사진은 클라우드에 올라가 있지만 무료 용량은 1GB예요. 파일로 한 벌 더 받아두면 용량과 상관없이 남습니다.'
              : '로그인하지 않으면 사진은 이 기기에만 남아요. 파일로 내보내면 사진까지 통째로 보관할 수 있어요.'}
          </p>
          <Link
            to="/settings/backup"
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-700"
          >
            <Download className="h-3.5 w-3.5" />
            백업 파일 저장
          </Link>
        </div>
      </div>
    </div>
  );
}
