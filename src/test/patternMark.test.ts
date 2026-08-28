import { describe, it, expect } from 'vitest';
import {
  distanceToStroke, markAt, shouldAddPoint, MARK_WIDTH, MARK_COLORS, MIN_POINT_GAP,
} from '@/lib/patternMark';
import type { PatternMark } from '@/lib/db';

// ----------------------------------------------------------------------------
// 도안 형광펜
// ----------------------------------------------------------------------------
// 자국은 도안 좌표(0~1)로 남긴다. 화면 좌표로 두면 확대하는 순간 밑줄이
// 엉뚱한 자리로 가고, 폰과 태블릿에서 서로 다른 곳에 찍힌다.

function mark(points: number[], extra: Partial<PatternMark> = {}): PatternMark {
  return {
    id: 1, patternFileId: 1, page: 1, points,
    color: '#FFE45C', width: MARK_WIDTH, createdAt: 1, ...extra,
  };
}

describe('선까지의 거리', () => {
  it('선 위의 점은 거리가 0', () => {
    // 가로로 그은 선의 한가운데
    expect(distanceToStroke([0, 0.5, 1, 0.5], 0.5, 0.5)).toBeCloseTo(0, 5);
  });

  it('선의 가운데를 눌러도 걸린다', () => {
    // 점만 비교하면 길게 그은 선의 가운데가 안 걸린다 —
    // 지우개로 밑줄 한가운데를 눌렀는데 아무 일도 안 일어나면 고장으로 보인다
    const d = distanceToStroke([0, 0.5, 1, 0.5], 0.5, 0.52);
    expect(d).toBeCloseTo(0.02, 5);
  });

  it('선 밖으로 벗어나면 가까운 끝점까지의 거리', () => {
    expect(distanceToStroke([0.4, 0.5, 0.6, 0.5], 0.9, 0.5)).toBeCloseTo(0.3, 5);
  });

  it('점이 하나뿐이면 그 점까지의 거리', () => {
    expect(distanceToStroke([0.5, 0.5], 0.5, 0.6)).toBeCloseTo(0.1, 5);
  });

  it('빈 선은 닿지 않는다', () => {
    expect(distanceToStroke([], 0.5, 0.5)).toBe(Infinity);
  });
});

describe('지우개가 고르는 자국', () => {
  it('가까운 것을 고른다', () => {
    const near = mark([0, 0.50, 1, 0.50], { id: 1 });
    const far  = mark([0, 0.90, 1, 0.90], { id: 2 });
    expect(markAt([near, far], 0.5, 0.51, 0.03)?.id).toBe(1);
  });

  it('멀면 아무것도 안 고른다', () => {
    // 빈 곳을 눌렀는데 엉뚱한 자국이 지워지면 안 된다
    expect(markAt([mark([0, 0.1, 1, 0.1])], 0.5, 0.8, 0.03)).toBeNull();
  });

  it('굵게 그은 자국은 더 넓게 걸린다', () => {
    // 눈에 보이는 굵기만큼은 눌러서 지울 수 있어야 한다
    const thick = mark([0, 0.5, 1, 0.5], { width: 0.2 });
    expect(markAt([thick], 0.5, 0.58, 0.01)).not.toBeNull();
  });
});

describe('점 솎아내기', () => {
  it('첫 점은 언제나 받는다', () => {
    expect(shouldAddPoint([], 0.1, 0.1)).toBe(true);
  });

  it('앞 점과 너무 가까우면 버린다', () => {
    // 손가락은 1초에 수십 번 자리를 알려준다. 그대로 담으면 짧은 밑줄 하나에
    // 점이 수백 개가 되어 저장도 그리기도 무거워진다.
    expect(shouldAddPoint([0.5, 0.5], 0.5 + MIN_POINT_GAP / 2, 0.5)).toBe(false);
  });

  it('충분히 움직였으면 받는다', () => {
    expect(shouldAddPoint([0.5, 0.5], 0.5 + MIN_POINT_GAP * 2, 0.5)).toBe(true);
  });
});

describe('굵기와 색', () => {
  it('굵기는 픽셀이 아니라 비율', () => {
    // 픽셀로 정하면 확대했을 때 실처럼 가늘어진다
    expect(MARK_WIDTH).toBeGreaterThan(0);
    expect(MARK_WIDTH).toBeLessThan(0.1);
  });

  it('색은 네 가지', () => {
    expect(MARK_COLORS).toHaveLength(4);
    for (const c of MARK_COLORS) expect(c.css).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
