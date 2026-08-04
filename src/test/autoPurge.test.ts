import { describe, it, expect } from 'vitest';
import {
  selectExpiredTrash,
  trashDaysLeft,
  trashExpiresAt,
  TRASH_RETENTION_DAYS,
  TRASH_RETENTION_MS,
} from '@/lib/autoPurge';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe('보관 기간 계산', () => {
  it('보관 기간은 7일', () => {
    expect(TRASH_RETENTION_DAYS).toBe(7);
    expect(TRASH_RETENTION_MS).toBe(7 * DAY);
  });

  it('만료 시각은 삭제 시각 + 7일', () => {
    expect(trashExpiresAt(NOW)).toBe(NOW + 7 * DAY);
  });

  it('deletedAt 이 없으면 만료 시각도 없다', () => {
    expect(trashExpiresAt(null)).toBeNull();
    expect(trashDaysLeft(undefined)).toBeNull();
  });

  it('방금 삭제한 항목은 7일 남음', () => {
    expect(trashDaysLeft(NOW, NOW)).toBe(7);
  });

  it('6일 지난 항목은 1일 남음', () => {
    expect(trashDaysLeft(NOW - 6 * DAY, NOW)).toBe(1);
  });

  it('기간이 지난 항목은 음수가 아니라 0', () => {
    expect(trashDaysLeft(NOW - 30 * DAY, NOW)).toBe(0);
  });
});

describe('selectExpiredTrash', () => {
  const cutoff = NOW - TRASH_RETENTION_MS;

  it('7일이 지난 항목만 삭제 대상', () => {
    const { expiredIds } = selectExpiredTrash(
      [
        { id: 1, isDeleted: true, deletedAt: NOW - 8 * DAY },  // 만료
        { id: 2, isDeleted: true, deletedAt: NOW - 6 * DAY },  // 아직
        { id: 3, isDeleted: true, deletedAt: NOW },            // 방금
      ],
      cutoff,
    );
    expect(expiredIds).toEqual([1]);
  });

  it('정확히 7일 경계인 항목은 삭제한다', () => {
    const { expiredIds } = selectExpiredTrash(
      [{ id: 1, isDeleted: true, deletedAt: cutoff }],
      cutoff,
    );
    expect(expiredIds).toEqual([1]);
  });

  it('삭제되지 않은 항목은 절대 지우지 않는다 (안전장치)', () => {
    const { expiredIds, missingTimestampIds } = selectExpiredTrash(
      [
        { id: 1, isDeleted: false, deletedAt: NOW - 100 * DAY },
        { id: 2, deletedAt: NOW - 100 * DAY },
      ],
      cutoff,
    );
    expect(expiredIds).toHaveLength(0);
    expect(missingTimestampIds).toHaveLength(0);
  });

  it('deletedAt 이 없는 레거시 항목은 삭제하지 않고 보정 대상으로 분류', () => {
    const { expiredIds, missingTimestampIds } = selectExpiredTrash(
      [
        { id: 1, isDeleted: true },
        { id: 2, isDeleted: true, deletedAt: null },
        { id: 3, isDeleted: true, deletedAt: NaN },
      ],
      cutoff,
    );
    expect(expiredIds).toHaveLength(0);
    expect(missingTimestampIds).toEqual([1, 2, 3]);
  });

  it('id 가 없는 행은 무시한다', () => {
    const { expiredIds } = selectExpiredTrash(
      [{ isDeleted: true, deletedAt: NOW - 100 * DAY }],
      cutoff,
    );
    expect(expiredIds).toHaveLength(0);
  });
});
