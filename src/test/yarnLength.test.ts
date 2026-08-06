import { describe, it, expect } from 'vitest';
import { gramsToMeters, formatMeters } from '@/lib/yarnCalc';

// ----------------------------------------------------------------------------
// 실 길이 환산 — 콘사처럼 무게로만 파는 실의 총 길이를 대신 계산해 준다
// ----------------------------------------------------------------------------
// 사용자가 손으로 하던 계산을 대신하는 자리라, 틀리면 도안에 실이 모자란지
// 남는지를 반대로 알려주게 된다. 경계값을 특히 조심해서 본다.

describe('gramsToMeters', () => {
  it('100g당 길이를 기준으로 총 길이를 낸다', () => {
    // 400m/100g 짜리 실을 500g 가지고 있으면 2000m
    expect(gramsToMeters(500, 400)).toBe(2000);
  });

  it('100g 미만도 비례해서 낸다', () => {
    expect(gramsToMeters(50, 400)).toBe(200);
    expect(gramsToMeters(25, 400)).toBe(100);
  });

  it('남은 무게가 0이면 0m — 다 썼다는 뜻이니 감추지 않는다', () => {
    expect(gramsToMeters(0, 400)).toBe(0);
  });

  it('기준값을 안 적었으면 계산하지 않는다', () => {
    // 0m 라고 적으면 "실이 없다"로 잘못 읽힌다. 모르면 모른다고 해야 한다.
    expect(gramsToMeters(500, undefined)).toBeNull();
    expect(gramsToMeters(500, 0)).toBeNull();
    expect(gramsToMeters(500, -10)).toBeNull();
  });

  it('무게가 음수이거나 숫자가 아니면 계산하지 않는다', () => {
    expect(gramsToMeters(-5, 400)).toBeNull();
    expect(gramsToMeters(NaN, 400)).toBeNull();
  });
});

describe('formatMeters', () => {
  it('소수점은 버리고 미터로 적는다', () => {
    expect(formatMeters(200)).toBe('200m');
    expect(formatMeters(333.4)).toBe('333m');
    expect(formatMeters(999)).toBe('999m');
  });

  it('아무리 길어도 km 로 접지 않는다 — 단위가 섞이면 비교가 안 된다', () => {
    expect(formatMeters(1000)).toBe('1,000m');
    expect(formatMeters(2500)).toBe('2,500m');
    expect(formatMeters(12000)).toBe('12,000m');
  });
});
