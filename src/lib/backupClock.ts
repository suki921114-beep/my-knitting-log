// ----------------------------------------------------------------------------
// 마지막으로 백업한 시각
// ----------------------------------------------------------------------------
// 백업하는 길이 두 갈래다 — 클라우드에 올리기, 파일로 내려받기.
// 홈의 알림은 "둘 중 아무것도 안 한 지 오래됐을 때"만 떠야 한다.
// 클라우드에 잘 올려두었는데 파일을 안 받았다고 재촉하면 성가시기만 하다.
//
// 기기마다 따로 센다(localStorage). 폰에서 백업했다고 태블릿의 데이터가
// 안전해지는 건 아니므로, 이 경우엔 기기별로 세는 쪽이 맞다.

export const LAST_FILE_BACKUP_KEY = 'lastBackupAt';
export const LAST_CLOUD_BACKUP_KEY = 'lastCloudBackupAt';

function read(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const t = Date.parse(raw);
    return Number.isNaN(t) ? null : t;
  } catch {
    // 시크릿 모드 등에서 localStorage 가 막혀 있을 수 있다
    return null;
  }
}

function write(key: string) {
  try {
    localStorage.setItem(key, new Date().toISOString());
  } catch {
    /* 기록에 실패해도 백업 자체는 끝난 상태다. 조용히 넘어간다. */
  }
}

/** 백업 파일을 내려받았을 때 */
export function markFileBackup() {
  write(LAST_FILE_BACKUP_KEY);
}

/** 클라우드 백업이 실패 없이 끝났을 때 */
export function markCloudBackup() {
  write(LAST_CLOUD_BACKUP_KEY);
}

/** 두 갈래 중 더 최근 시각 (둘 다 없으면 null) */
export function lastBackupTime(): number | null {
  const times = [read(LAST_FILE_BACKUP_KEY), read(LAST_CLOUD_BACKUP_KEY)]
    .filter((t): t is number => t !== null);
  return times.length ? Math.max(...times) : null;
}

/** 마지막 백업 이후 지난 날수 (한 번도 안 했으면 null) */
export function daysSinceLastBackup(nowMs: number = Date.now()): number | null {
  const t = lastBackupTime();
  if (t === null) return null;
  return Math.floor((nowMs - t) / (24 * 60 * 60 * 1000));
}
