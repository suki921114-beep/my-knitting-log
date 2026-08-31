import { describe, it, expect } from 'vitest';
import { MOODS, firstGrapheme, isMoodLike, isDefaultMood } from '@/lib/mood';

// ----------------------------------------------------------------------------
// 다이어리 기분 이모지
// ----------------------------------------------------------------------------
// 여기서 틀리면 화면에 깨진 네모(�)가 저장된다. 저장된 뒤에는 고칠 방법이
// 없으니(무엇이었는지 알 수 없다) 넣는 순간에 막아야 한다.

describe('이모지 한 개만 남기기', () => {
  it('평범한 이모지', () => {
    expect(firstGrapheme('😍')).toBe('😍');
  });

  it('두 칸을 쓰는 이모지를 반토막 내지 않는다 — s[0] 로 자르면 여기서 깨진다', () => {
    const g = firstGrapheme('😊');
    expect(g).toBe('😊');
    expect(g).not.toBe('\uD83D');
  });

  it('여러 글자가 붙어 하나로 보이는 것도 통째로 가져온다', () => {
    expect(firstGrapheme('😮‍💨')).toBe('😮‍💨');
  });

  it('여러 개를 넣으면 첫 번째만', () => {
    expect(firstGrapheme('🧶😊🔥')).toBe('🧶');
  });

  it('앞뒤 빈칸은 털어낸다', () => {
    expect(firstGrapheme('  🎉  ')).toBe('🎉');
  });

  it('빈 값', () => {
    expect(firstGrapheme('')).toBe('');
    expect(firstGrapheme('   ')).toBe('');
  });
});

describe('이모지인지 가리기', () => {
  it('이모지는 통과', () => {
    for (const m of MOODS) expect(isMoodLike(m)).toBe(true);
    expect(isMoodLike('😍')).toBe(true);
  });

  it('글자와 숫자는 막는다 — 자판을 잘못 친 것이다', () => {
    expect(isMoodLike('가')).toBe(false);
    expect(isMoodLike('a')).toBe(false);
    expect(isMoodLike('7')).toBe(false);
    expect(isMoodLike('!')).toBe(false);
  });

  it('빈 값은 막는다', () => {
    expect(isMoodLike('')).toBe(false);
    expect(isMoodLike('   ')).toBe(false);
  });
});

describe('기본 목록', () => {
  it('기본에 있는 것은 최근 목록에 또 담지 않는다', () => {
    expect(isDefaultMood('🧶')).toBe(true);
    expect(isDefaultMood('😍')).toBe(false);
  });

  it('겹치는 이모지가 없다 — 같은 것이 두 번 보이면 고르다 헷갈린다', () => {
    expect(new Set(MOODS).size).toBe(MOODS.length);
  });
});
