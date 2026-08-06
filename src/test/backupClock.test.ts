import { describe, it, expect, beforeEach } from 'vitest';
import {
  LAST_FILE_BACKUP_KEY,
  LAST_CLOUD_BACKUP_KEY,
  daysSinceLastBackup,
  markCloudBackup,
  markFileBackup,
} from '@/lib/backupClock';

// ----------------------------------------------------------------------------
// 백업 시계 — 홈의 재촉 알림이 언제 떠야 하는가
// ----------------------------------------------------------------------------
// 백업하는 길이 둘(클라우드 / 파일)인데 한쪽만 보면, 클라우드에 잘 올려둔
// 사람에게도 "백업한 지 오래됐다"고 재촉하게 된다. 그 실수를 막는 게 목적이다.

const DAY = 24 * 60 * 60 * 1000;

function setAgo(key: string, days: number) {
  localStorage.setItem(key, new Date(Date.now() - days * DAY).toISOString());
}

describe('daysSinceLastBackup', () => {
  beforeEach(() => localStorage.clear());

  it('한 번도 안 했으면 null', () => {
    expect(daysSinceLastBackup()).toBeNull();
  });

  it('파일로만 받았으면 그 시각을 센다', () => {
    setAgo(LAST_FILE_BACKUP_KEY, 5);
    expect(daysSinceLastBackup()).toBe(5);
  });

  it('클라우드에만 올렸어도 백업한 것으로 본다', () => {
    // 이게 핵심 — 클라우드만 쓰는 사람에게 파일을 안 받았다고 재촉하지 않는다
    setAgo(LAST_CLOUD_BACKUP_KEY, 3);
    expect(daysSinceLastBackup()).toBe(3);
  });

  it('둘 다 있으면 더 최근 쪽을 따른다', () => {
    setAgo(LAST_FILE_BACKUP_KEY, 30);
    setAgo(LAST_CLOUD_BACKUP_KEY, 2);
    expect(daysSinceLastBackup()).toBe(2);
  });

  it('오래된 쪽이 나중에 기록돼도 최근 쪽이 이긴다', () => {
    setAgo(LAST_CLOUD_BACKUP_KEY, 1);
    setAgo(LAST_FILE_BACKUP_KEY, 40);
    expect(daysSinceLastBackup()).toBe(1);
  });

  it('깨진 값은 없는 것으로 친다', () => {
    localStorage.setItem(LAST_FILE_BACKUP_KEY, '어제쯤');
    expect(daysSinceLastBackup()).toBeNull();
  });

  it('기록하면 0일이 된다', () => {
    markCloudBackup();
    expect(daysSinceLastBackup()).toBe(0);
    localStorage.clear();
    markFileBackup();
    expect(daysSinceLastBackup()).toBe(0);
  });
});
