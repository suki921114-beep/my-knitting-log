import { describe, it, expect } from 'vitest';
import { readNeedle, writeNeedle, describeNeedle, needleKindOf, splitSizes, formatNeedleSize, parseQuickSizes } from '@/lib/needleType';

// ----------------------------------------------------------------------------
// 바늘 종류 — 골라 담기로 바꾸면서 옛 기록이 다치지 않는지
// ----------------------------------------------------------------------------
// 종류를 글로 적던 시절의 값이 남아 있다. 특히 '줄바늘' 은 큰 갈래였는데
// 이제 대바늘의 세부 갈래다. 옛 기록이 '기타' 로 굴러떨어지면 안 된다.

describe('readNeedle', () => {
  it('큰 갈래를 그대로 읽는다', () => {
    expect(readNeedle({ type: '대바늘' })).toEqual({ kind: '대바늘', subType: undefined, tip: undefined });
    expect(readNeedle({ type: '코바늘' })).toEqual({ kind: '코바늘' });
    expect(readNeedle({ type: '장갑바늘' })).toEqual({ kind: '장갑바늘' });
  });

  it('옛 데이터의 줄바늘은 대바늘 아래로 옮겨 읽는다', () => {
    expect(readNeedle({ type: '줄바늘' })).toEqual({
      kind: '대바늘',
      subType: '줄바늘',
      tip: undefined,
    });
  });

  it('세부 갈래와 팁을 읽는다', () => {
    expect(readNeedle({ type: '대바늘', subType: '조립식', tipLength: '숏팁' })).toEqual({
      kind: '대바늘',
      subType: '조립식',
      tip: '숏팁',
    });
  });

  it('모르는 값은 기타로 두되 적어둔 말은 지키다', () => {
    expect(readNeedle({ type: '레이스 바늘' })).toEqual({ kind: '기타', custom: '레이스 바늘' });
  });

  it('비어 있으면 기타', () => {
    expect(readNeedle({})).toEqual({ kind: '기타', custom: undefined });
    expect(readNeedle({ type: '   ' })).toEqual({ kind: '기타', custom: undefined });
  });

  it('엉뚱한 세부 값은 버린다', () => {
    const r = readNeedle({ type: '대바늘', subType: '몰라요', tipLength: '중간팁' });
    expect(r.subType).toBeUndefined();
    expect(r.tip).toBeUndefined();
  });
});

describe('writeNeedle', () => {
  it('대바늘은 세부 갈래를 함께 저장한다', () => {
    expect(writeNeedle({ kind: '대바늘', subType: '조립식', tip: '롱팁' })).toEqual({
      type: '대바늘',
      subType: '조립식',
      tipLength: '롱팁',
    });
  });

  it('대바늘이 아니면 세부 갈래를 비운다', () => {
    // 대바늘로 적어뒀다가 코바늘로 바꾸면 '숏팁' 이 남아 엉뚱하게 보인다
    expect(writeNeedle({ kind: '코바늘', subType: '조립식', tip: '숏팁' })).toEqual({
      type: '코바늘',
      subType: undefined,
      tipLength: undefined,
    });
  });

  it('기타는 적은 말을 종류로 삼는다', () => {
    expect(writeNeedle({ kind: '기타', custom: ' 레이스 바늘 ' })).toEqual({
      type: '레이스 바늘',
      subType: undefined,
      tipLength: undefined,
    });
  });

  it('기타인데 아무것도 안 적었으면 기타로 남긴다', () => {
    expect(writeNeedle({ kind: '기타' }).type).toBe('기타');
  });

  it('읽고 쓰기를 반복해도 값이 흔들리지 않는다', () => {
    const stored = { type: '대바늘', subType: '줄바늘', tipLength: '숏팁' };
    expect(writeNeedle(readNeedle(stored))).toEqual(stored);
  });

  it('옛 줄바늘을 한 번 저장하면 정식 형태가 된다', () => {
    expect(writeNeedle(readNeedle({ type: '줄바늘' }))).toEqual({
      type: '대바늘',
      subType: '줄바늘',
      tipLength: undefined,
    });
  });
});

describe('describeNeedle', () => {
  it('갈래를 세로줄로 잇는다', () => {
    expect(describeNeedle({ type: '대바늘', subType: '조립식', tipLength: '숏팁' })).toBe('대바늘 | 조립식 | 숏팁');
  });

  it('없는 갈래는 빼고 잇는다', () => {
    expect(describeNeedle({ type: '대바늘' })).toBe('대바늘');
    expect(describeNeedle({ type: '대바늘', subType: '줄바늘' })).toBe('대바늘 | 줄바늘');
  });

  it('기타는 적어둔 말을 보여준다', () => {
    expect(describeNeedle({ type: '레이스 바늘' })).toBe('레이스 바늘');
  });
});

describe('needleKindOf', () => {
  it('옛 줄바늘도 대바늘로 묶인다', () => {
    // 목록에서 갈래별로 셀 때 옛것과 새것이 갈라지면 안 된다
    expect(needleKindOf({ type: '줄바늘' })).toBe('대바늘');
    expect(needleKindOf({ type: '대바늘', subType: '줄바늘' })).toBe('대바늘');
  });
});

describe('splitSizes', () => {
  it('쉼표로 끊는다', () => {
    expect(splitSizes('3.5, 3.75, 4')).toEqual(['3.5', '3.75', '4']);
  });

  it('중간이 비는 세트도 그대로 적힌 대로만 만든다', () => {
    // 범위로 받으면 3.75 를 없는데 있다고 적게 된다. 적은 것만 만든다.
    expect(splitSizes('3.5, 4, 4.5, 5.5')).toEqual(['3.5', '4', '4.5', '5.5']);
  });

  it('빗금과 줄바꿈도 끊는다', () => {
    expect(splitSizes('3.5 / 4\n4.5')).toEqual(['3.5', '4', '4.5']);
  });

  it('빈 칸과 중복 구분자는 흘려보낸다', () => {
    expect(splitSizes('3.5,, 4 ,')).toEqual(['3.5', '4']);
  });

  it('하나만 적으면 하나만', () => {
    expect(splitSizes('4.0mm')).toEqual(['4.0mm']);
  });

  it('아무것도 안 적으면 빈 목록', () => {
    expect(splitSizes('   ')).toEqual([]);
  });
});

describe('formatNeedleSize', () => {
  it('숫자만 적었으면 mm 를 붙인다', () => {
    expect(formatNeedleSize('3.5')).toBe('3.5mm');
    expect(formatNeedleSize('4')).toBe('4mm');
  });

  it('단위를 이미 적었으면 건드리지 않는다', () => {
    // 사람이 적어둔 말을 앱이 고쳐 쓰지 않는다
    expect(formatNeedleSize('4.0mm')).toBe('4.0mm');
    expect(formatNeedleSize('5호')).toBe('5호');
    expect(formatNeedleSize('US 6')).toBe('US 6');
  });

  it('앞뒤 공백은 털어낸다', () => {
    expect(formatNeedleSize('  3.75  ')).toBe('3.75mm');
  });

  it('비었으면 빈 값', () => {
    expect(formatNeedleSize('')).toBe('');
    expect(formatNeedleSize(undefined)).toBe('');
  });
});

// ----------------------------------------------------------------------------
// 호수만 적었을 때 바로 만들기
// ----------------------------------------------------------------------------
// 검색창에 적은 글이 '찾으려는 것' 인지 '만들려는 것' 인지를 가른다.
// 잘못 가르면 검색하려던 사람에게 만들기 버튼이 튀어나온다.

describe('바늘 간편 입력', () => {
  it('숫자만 적으면 mm 를 붙여 돌려준다', () => {
    expect(parseQuickSizes('4')).toEqual(['4mm']);
    expect(parseQuickSizes('3.5')).toEqual(['3.5mm']);
  });

  it('mm 를 붙여 적어도 받는다', () => {
    expect(parseQuickSizes('4.0mm')).toEqual(['4.0mm']);
    expect(parseQuickSizes('4 mm')).toEqual(['4mm']);
  });

  it('쉼표나 띄어쓰기로 여러 개', () => {
    expect(parseQuickSizes('3.5, 4, 4.5')).toEqual(['3.5mm', '4mm', '4.5mm']);
    expect(parseQuickSizes('3.5 4')).toEqual(['3.5mm', '4mm']);
  });

  it('같은 호수를 두 번 적어도 하나만', () => {
    expect(parseQuickSizes('4, 4.0')).toEqual(['4mm', '4.0mm']);
    expect(parseQuickSizes('4, 4')).toEqual(['4mm']);
  });

  it('글자가 섞이면 만들기가 아니라 검색이다', () => {
    expect(parseQuickSizes('치아오구 4')).toBeNull();
    expect(parseQuickSizes('5호')).toBeNull();
    expect(parseQuickSizes('줄바늘')).toBeNull();
  });

  it('비었으면 아무것도 아니다', () => {
    expect(parseQuickSizes('')).toBeNull();
    expect(parseQuickSizes('   ')).toBeNull();
  });
});
