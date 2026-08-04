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

export interface TrashRowLike {
  id?: number;
  isDeleted?: boolean;
  deletedAt?: number | null;
}

export interface PurgeSelection {
  /** 보관 기간이 지나 영구 삭제할 id */
  expiredIds: number[];
  /** deletedAt 이 없어 지금 시각으로 채워 넣어야 할 id (레거시 보정) */
  missingTimestampIds: number[];
}

/**
 * 어떤 휴지통 항목을 지울지 고른다. 부수효과 없음 — 테스트 대상.
 * @param cutoff 이 시각 이하로 삭제된 항목이 만료 대상
 */
export function selectExpiredTrash(rows: TrashRowLike[], cutoff: number): PurgeSelection {
  const expiredIds: number[] = [];
  const missingTimestampIds: number[] = [];

  for (const r of rows) {
    if (r.id == null) continue;
    // isDeleted 가 아닌 행이 섞여 들어와도 절대 지우지 않는다 (안전장치)
    if (r.isDeleted !== true) continue;

    if (typeof r.deletedAt !== 'number' || Number.isNaN(r.deletedAt)) {
      missingTimestampIds.push(r.id);
    } else if (r.deletedAt <= cutoff) {
      expiredIds.push(r.id);
    }
  }

  return { expiredIds, missingTimestampIds };
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
      const { expiredIds, missingTimestampIds } = selectExpiredTrash(rows, cutoff);

      // 레거시 보정 — 삭제 시각이 없으면 지금부터 카운트
      for (const id of missingTimestampIds) {
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
