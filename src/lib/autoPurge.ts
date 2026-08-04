// ----------------------------------------------------------------------------
// 휴지통 자동 영구삭제
// ----------------------------------------------------------------------------
// soft delete(isDeleted=true) 된 항목은 deletedAt 으로부터 보관 기간이 지나면
// 이 기기에서 자동으로 hard delete 된다.
// 클라우드의 묘비(isDeleted=true 문서)는 그대로 남아 다른 기기에서 부활하지 않는다.

import { db } from '@/lib/db';

/** 휴지통 보관 기간 (일) */
export const TRASH_RETENTION_DAYS = 7;
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const TRASH_TABLES = [
  'yarns',
  'patterns',
  'needles',
  'notions',
  'projects',
  'rowCounters',
  'projectGauges',
] as const;

/** 자동 영구삭제 예정 시각 (deletedAt 이 없으면 null) */
export function trashExpiresAt(deletedAt?: number | null): number | null {
  return typeof deletedAt === 'number' ? deletedAt + TRASH_RETENTION_MS : null;
}

/** 자동 영구삭제까지 남은 일수 (올림, 최소 0). deletedAt 이 없으면 null */
export function trashDaysLeft(deletedAt?: number | null, nowMs: number = Date.now()): number | null {
  const expires = trashExpiresAt(deletedAt);
  if (expires === null) return null;
  return Math.max(0, Math.ceil((expires - nowMs) / (24 * 60 * 60 * 1000)));
}

/**
 * 보관 기간이 지난 휴지통 항목을 영구 삭제한다.
 * deletedAt 이 없는 레거시 항목은 지금 시각으로 채워 넣어 보관 기간을 새로 시작한다.
 * @returns 실제로 삭제된 항목 수
 */
export async function purgeExpiredTrash(nowMs: number = Date.now()): Promise<number> {
  const cutoff = nowMs - TRASH_RETENTION_MS;
  let purged = 0;

  for (const name of TRASH_TABLES) {
    const table = (db as any)[name];
    if (!table) continue;

    try {
      const rows: any[] = await table.filter((r: any) => r.isDeleted === true).toArray();
      const expiredIds: number[] = [];
      const missingTimestamp: number[] = [];

      for (const r of rows) {
        if (r.id == null) continue;
        if (typeof r.deletedAt !== 'number' || Number.isNaN(r.deletedAt)) {
          missingTimestamp.push(r.id);
        } else if (r.deletedAt <= cutoff) {
          expiredIds.push(r.id);
        }
      }

      // 레거시 보정 — 삭제 시각이 없으면 지금부터 카운트
      for (const id of missingTimestamp) {
        await table.update(id, { deletedAt: nowMs });
      }

      if (expiredIds.length) {
        await table.bulkDelete(expiredIds);
        purged += expiredIds.length;
      }
    } catch (e) {
      console.error(`[autoPurge] ${name} 자동 영구삭제 실패:`, e);
    }
  }

  if (purged > 0) {
    console.info(`[autoPurge] 보관 기간(${TRASH_RETENTION_DAYS}일) 경과 항목 ${purged}개를 영구 삭제했어요.`);
  }
  return purged;
}

let started = false;

/**
 * 앱 시작 시 1회 호출. 즉시 한 번 정리하고,
 * 이후 1시간마다 + 앱이 다시 포그라운드로 돌아올 때마다 정리한다.
 */
export function startTrashAutoPurge() {
  if (started) return;
  started = true;

  const run = () => {
    purgeExpiredTrash().catch(e => console.error('[autoPurge] 실행 실패:', e));
  };

  run();
  setInterval(run, 60 * 60 * 1000);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') run();
    });
  }
}
