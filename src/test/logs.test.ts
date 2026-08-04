import { describe, it, expect, vi, afterEach } from 'vitest';
import { todayStr, formatLogDate, groupByDate } from '@/lib/logs';
import type { KnitLog } from '@/lib/db';

function log(date: string, text: string, createdAt = 0): KnitLog {
  return { date, text, createdAt, updatedAt: createdAt } as KnitLog;
}

afterEach(() => vi.useRealTimers());

describe('todayStr', () => {
  it('로컬 기준 YYYY-MM-DD 를 만든다', () => {
    expect(todayStr(new Date(2026, 7, 4))).toBe('2026-08-04');
  });

  it('한 자리 월/일을 0으로 채운다', () => {
    expect(todayStr(new Date(2026, 0, 9))).toBe('2026-01-09');
  });

  it('UTC 가 아니라 로컬 날짜를 쓴다 (자정 무렵 하루 밀림 방지)', () => {
    // 로컬 23시 — toISOString 을 썼다면 다음 날로 밀린다
    expect(todayStr(new Date(2026, 7, 4, 23, 30))).toBe('2026-08-04');
  });
});

describe('formatLogDate', () => {
  it('오늘과 어제는 말로 표시한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 4, 12));
    expect(formatLogDate('2026-08-04')).toBe('오늘');
    expect(formatLogDate('2026-08-03')).toBe('어제');
  });

  it('그 외에는 날짜로 표시한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 4, 12));
    const out = formatLogDate('2026-07-20');
    expect(out).not.toBe('오늘');
    expect(out).toContain('7');
  });

  it('이상한 값이 와도 깨지지 않는다', () => {
    expect(formatLogDate('not-a-date')).toBe('not-a-date');
  });
});

describe('groupByDate', () => {
  it('날짜별로 묶고 최신 날짜가 위로 온다', () => {
    const g = groupByDate([
      log('2026-08-01', 'a'),
      log('2026-08-03', 'b'),
      log('2026-08-02', 'c'),
    ]);
    expect(g.map(x => x.date)).toEqual(['2026-08-03', '2026-08-02', '2026-08-01']);
  });

  it('같은 날 안에서는 나중에 쓴 것이 위로 온다', () => {
    const g = groupByDate([
      log('2026-08-04', '아침', 100),
      log('2026-08-04', '저녁', 900),
    ]);
    expect(g[0].items.map(i => i.text)).toEqual(['저녁', '아침']);
  });

  it('빈 배열은 빈 결과', () => {
    expect(groupByDate([])).toEqual([]);
  });

  it('모든 기록이 어느 그룹엔가 정확히 한 번씩 들어간다', () => {
    const logs = [log('2026-08-01', 'a'), log('2026-08-01', 'b'), log('2026-08-02', 'c')];
    const total = groupByDate(logs).reduce((acc, g) => acc + g.items.length, 0);
    expect(total).toBe(logs.length);
  });
});
