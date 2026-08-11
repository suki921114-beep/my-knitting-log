import { describe, it, expect } from 'vitest';
import { toGaugeRows, fromGaugeRows, gaugeSearchText, describeGauge, emptyGaugeRow } from '@/lib/gauge';

// ----------------------------------------------------------------------------
// 게이지 — 실과 도안이 함께 쓴다
// ----------------------------------------------------------------------------
// 쓰는 흐름이 양방향이다.
//   "이 실에 맞는 도안이 뭐가 있지?"  → 실의 게이지로 도안을 찾는다
//   "이 도안에 맞는 실이 뭐가 있지?"  → 도안의 게이지로 실을 찾는다
// 그래서 검색 글자를 넉넉히 담아야 한다. 못 찾는 것보다 좀 더 나오는 게 낫다.

describe('화면 ↔ 저장 왕복', () => {
  it('적은 값이 그대로 돌아온다', () => {
    const rows = [{ strands: '2', needleSize: '4.0', gauge: '22코 30단', gaugePattern: '메리야스', washState: '세탁 후' }];
    const specs = fromGaugeRows(rows)!;
    expect(specs[0]).toEqual({
      strands: 2, needleSize: '4.0', gauge: '22코 30단', gaugePattern: '메리야스', washState: '세탁 후',
    });
    expect(toGaugeRows(specs)).toEqual(rows);
  });

  it('바늘과 코단을 둘 다 비운 줄은 버린다', () => {
    // 추가만 누르고 아무것도 안 적은 줄이다. 저장할 이유가 없다.
    expect(fromGaugeRows([emptyGaugeRow(1)])).toBeUndefined();
    expect(fromGaugeRows([{ ...emptyGaugeRow(1), gaugePattern: '무늬' }])).toBeUndefined();
  });

  it('한쪽만 적었으면 남긴다', () => {
    expect(fromGaugeRows([{ ...emptyGaugeRow(1), needleSize: '4' }])).toHaveLength(1);
    expect(fromGaugeRows([{ ...emptyGaugeRow(1), gauge: '20코' }])).toHaveLength(1);
  });

  it('겹수 순으로 정렬한다', () => {
    const specs = fromGaugeRows([
      { ...emptyGaugeRow(3), gauge: 'c' },
      { ...emptyGaugeRow(1), gauge: 'a' },
      { ...emptyGaugeRow(2), gauge: 'b' },
    ])!;
    expect(specs.map(s => s.strands)).toEqual([1, 2, 3]);
  });

  it('겹수를 안 적었으면 1겹으로 본다', () => {
    // 0겹은 말이 안 된다. 대부분 한 가닥으로 뜬다.
    expect(fromGaugeRows([{ ...emptyGaugeRow(1), strands: '', gauge: '20코' }])![0].strands).toBe(1);
  });
});

describe('검색 글자', () => {
  const specs = fromGaugeRows([
    { strands: '1', needleSize: '4', gauge: '22코 30단', gaugePattern: '메리야스', washState: '세탁 전' },
  ]);

  it('숫자만 쳐도, 단위를 붙여 쳐도 찾힌다', () => {
    // 사람이 '4' 라고 칠지 '4mm' 라고 칠지 알 수 없다
    const text = gaugeSearchText(specs);
    expect(text).toContain('4');
    expect(text).toContain('4mm');
  });

  it('코단 일부만 쳐도 찾힌다', () => {
    expect(gaugeSearchText(specs)).toContain('22코');
  });

  it('겹수와 조건도 담긴다', () => {
    const text = gaugeSearchText(specs);
    expect(text).toContain('1겹');
    expect(text).toContain('메리야스');
    expect(text).toContain('세탁 전');
  });

  it("옛 이름 '무메' 로 저장된 것도 '메리야스' 로 찾힌다", () => {
    const old = gaugeSearchText([{ strands: 1, gauge: '20코', gaugePattern: '무메' }]);
    expect(old).toContain('메리야스');
    expect(old).toContain('무메');
  });

  it('게이지가 없으면 빈 글자 — 아무 검색어에나 걸리면 안 된다', () => {
    expect(gaugeSearchText(undefined)).toBe('');
    expect(gaugeSearchText([])).toBe('');
  });
});

describe('사람이 읽는 말', () => {
  it('조건부터 값 순으로 잇는다', () => {
    expect(describeGauge({ strands: 2, needleSize: '4', gauge: '22코 30단', gaugePattern: '메리야스', washState: '세탁 후' }))
      .toBe('메리야스 · 세탁 후 · 2겹 · 4mm · 22코 30단');
  });

  it('없는 것은 빼고 잇는다', () => {
    expect(describeGauge({ strands: 1, gauge: '20코' })).toBe('1겹 · 20코');
  });

  it('옛 이름은 지금 이름으로 보여준다', () => {
    expect(describeGauge({ strands: 1, gaugePattern: '무메', gauge: '20코' })).toContain('메리야스');
  });
});
