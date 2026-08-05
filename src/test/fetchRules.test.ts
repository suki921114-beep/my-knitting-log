import { describe, it, expect } from 'vitest';
import { decideFetch } from '@/lib/sync/fetchRules';

// ----------------------------------------------------------------------------
// 가져오기 판정
// ----------------------------------------------------------------------------
// 실제로 났던 버그 두 가지를 여기서 막는다.
//   1) 휴지통을 비운 뒤 가져오기 → 지운 항목이 휴지통에 되살아남
//   2) 방금 기기에서 바꾼 값이 클라우드의 옛 값으로 덮임

describe('삭제된 원격 레코드', () => {
  it('이 기기에 없으면 받아오지 않는다 (휴지통 부활 방지)', () => {
    expect(decideFetch({ isDeleted: true, updatedAt: 100 }, undefined)) .toBe('skip');
  });

  it('되돌리기(force)에서도 받아오지 않는다', () => {
    expect(decideFetch({ isDeleted: true, updatedAt: 100 }, undefined, true)).toBe('skip');
  });

  it('이 기기에 남아 있으면 삭제 상태를 반영한다', () => {
    // 다른 기기에서 지운 것이 이 기기에도 전파되어야 한다
    expect(decideFetch({ isDeleted: true, updatedAt: 200 }, { updatedAt: 100 })).toBe('update');
  });
});

describe('일반 레코드', () => {
  it('이 기기에 없으면 추가한다', () => {
    expect(decideFetch({ updatedAt: 100 }, undefined)).toBe('add');
  });

  it('원격이 더 최신이면 덮어쓴다', () => {
    expect(decideFetch({ updatedAt: 200 }, { updatedAt: 100 })).toBe('update');
  });

  it('로컬이 더 최신이면 그대로 둔다', () => {
    expect(decideFetch({ updatedAt: 100 }, { updatedAt: 200 })).toBe('skip');
  });

  it('시각이 같으면 그대로 둔다', () => {
    expect(decideFetch({ updatedAt: 100 }, { updatedAt: 100 })).toBe('skip');
  });

  it('되돌리기는 로컬이 더 최신이어도 덮어쓴다', () => {
    expect(decideFetch({ updatedAt: 100 }, { updatedAt: 200 }, true)).toBe('update');
  });

  it('updatedAt 이 없어도 터지지 않는다', () => {
    expect(decideFetch({}, {})).toBe('skip');
    expect(decideFetch({ updatedAt: 1 }, {})).toBe('update');
  });
});
