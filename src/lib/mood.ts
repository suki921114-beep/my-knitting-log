// ----------------------------------------------------------------------------
// 다이어리 기분 이모지
// ----------------------------------------------------------------------------
// 기본으로 보여주는 것은 뜨다가 자주 겪는 기분들이다. 그래도 여섯 개로는
// 모자란다는 말을 들었다 — 사람마다 남기고 싶은 기분이 다르다.
//
// 그렇다고 이모지를 백 개 늘어놓으면 고르는 데 시간이 더 걸린다. 자주 쓰는
// 것만 앞에 두고, 나머지는 폰 자판으로 직접 넣게 한다. 자판에는 이미 모든
// 이모지가 있으니 우리가 목록을 들고 있을 이유가 없다.

/** 처음 보이는 것들 */
export const MOODS = [
  '🧶', '😊', '🔥', '💪', '😮‍💨', '😴', '🥲', '🎉', '❤️', '☕',
] as const;

const RECENT_KEY = 'diaryMoodRecent';
/** 직접 넣은 것을 기억할 개수 — 줄이 넘치지 않을 만큼만 */
export const MAX_RECENT_MOODS = 6;

/**
 * 이모지 하나만 남긴다.
 *
 * ⚠️ `[...s]` 로 잘라야 한다. `s[0]` 이나 `slice(0,1)` 은 UTF-16 한 칸만
 *    가져와서 대부분의 이모지가 반토막 난다 (😊 는 두 칸을 쓴다).
 *    깃발이나 😮‍💨 처럼 여러 글자가 붙어 하나로 보이는 것도 있어서,
 *    Intl.Segmenter 가 있으면 그걸 먼저 쓴다.
 */
export function firstGrapheme(input: string): string {
  const s = input.trim();
  if (!s) return '';
  // Segmenter 는 아직 없는 환경이 있다 (구형 안드로이드 웹뷰).
  // 타입에도 없을 수 있어 any 로 더듬는다 — 없으면 아래로 떨어진다.
  const Seg = (Intl as unknown as {
    Segmenter?: new (l?: string, o?: { granularity: string }) => {
      segment(s: string): Iterable<{ segment: string }>;
    };
  }).Segmenter;
  if (Seg) {
    const seg = new Seg(undefined, { granularity: 'grapheme' });
    for (const g of seg.segment(s)) return g.segment;
  }
  return [...s][0] ?? '';
}

/** 글자나 숫자는 기분이 아니다 — 실수로 자판을 친 것으로 본다 */
export function isMoodLike(value: string): boolean {
  const g = firstGrapheme(value);
  if (!g) return false;
  return !/^[\p{L}\p{N}\p{P}\s]$/u.test(g);
}

export function recentMoods(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(v => typeof v === 'string' && v).slice(0, MAX_RECENT_MOODS);
  } catch {
    // 저장 공간이 막혀 있어도 기분 고르기는 되어야 한다
    return [];
  }
}

/** 방금 쓴 것을 맨 앞으로. 기본 목록에 있는 것은 담지 않는다 */
export function rememberMood(mood: string): string[] {
  const next = [mood, ...recentMoods().filter(m => m !== mood)].slice(0, MAX_RECENT_MOODS);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // 기억 못 해도 그만이다
  }
  return next;
}

export function isDefaultMood(mood: string): boolean {
  return (MOODS as readonly string[]).includes(mood);
}
