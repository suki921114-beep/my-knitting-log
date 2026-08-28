// ----------------------------------------------------------------------------
// 도안 형광펜
// ----------------------------------------------------------------------------
// 뜨다 보면 지금 뜨는 단, 내 사이즈 칸, 헷갈리는 무늬에 표시를 하고 싶다.
// 종이 도안에 형광펜 긋듯이.
//
// ⚠️ 자국은 반드시 도안 좌표(0~1)로 남긴다.
//    화면 좌표로 두면 확대하는 순간 밑줄이 엉뚱한 자리로 간다. 같은 도안이라도
//    폰과 태블릿에서 화면 크기가 달라서, 애초에 화면 좌표로는 남길 수가 없다.
//    그릴 때 0~1 로 바꾸고, 보여줄 때 그때의 화면 크기를 곱한다.
//
// 자국은 기기에만 둔다. 몇 KB 밖에 안 되지만 클라우드에 태우려면 파일과 짝을
// 맞추는 일이 또 붙는다. 먼저 쓸 만한지 보고 나중에 정한다.

import { db, type PatternMark } from '@/lib/db';

/** 고를 수 있는 색 — 종이에 쓰는 형광펜에서 가져왔다 */
export const MARK_COLORS = [
  { key: 'yellow', label: '노랑', css: '#FFE45C' },
  { key: 'pink',   label: '분홍', css: '#FF9EC4' },
  { key: 'green',  label: '연두', css: '#A8E06A' },
  { key: 'blue',   label: '하늘', css: '#8FD0FF' },
] as const;

/**
 * 선 굵기 — 도안 너비에 대한 비율.
 *
 * 픽셀로 정하면 확대했을 때 실처럼 가늘어진다. 비율로 두면 어느 배율에서든
 * 종이에 그은 것과 같은 굵기로 보인다.
 */
export const MARK_WIDTH = 0.022;
export const MIN_MARK_WIDTH = 0.008;
export const MAX_MARK_WIDTH = 0.06;

/**
 * 기본 진하기.
 *
 * 형광펜은 아래 글자가 비쳐야 한다. 진하게 덮으면 '무엇에 표시했는지' 를
 * 알 수 없게 되어, 표시하는 의미가 사라진다.
 */
export const MARK_OPACITY = 0.5;
export const MIN_MARK_OPACITY = 0.15;
export const MAX_MARK_OPACITY = 0.9;

/** 이 칸이 생기기 전에 그은 자국은 기본값으로 본다 */
export function markOpacity(m: { opacity?: number }): number {
  return m.opacity ?? MARK_OPACITY;
}

/** 이 파일의 이 쪽에 그어둔 자국들 */
export async function marksFor(patternFileId: number, page: number): Promise<PatternMark[]> {
  return db.patternMarks.where('[patternFileId+page]').equals([patternFileId, page]).toArray();
}

export async function addMark(mark: Omit<PatternMark, 'id' | 'createdAt'>): Promise<number> {
  return (await db.patternMarks.add({ ...mark, createdAt: Date.now() })) as number;
}

/** 마지막에 그은 것 하나를 무른다 */
export async function undoLastMark(patternFileId: number, page: number): Promise<boolean> {
  const rows = await marksFor(patternFileId, page);
  if (!rows.length) return false;
  const last = rows.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
  await db.patternMarks.delete(last.id!);
  return true;
}

export async function clearMarks(patternFileId: number, page: number): Promise<void> {
  await db.patternMarks.where('[patternFileId+page]').equals([patternFileId, page]).delete();
}

/** 파일을 지울 때 자국도 함께 */
export async function deleteMarksForFiles(patternFileIds: number[]): Promise<void> {
  if (!patternFileIds.length) return;
  await db.patternMarks.where('patternFileId').anyOf(patternFileIds).delete();
}

/**
 * 톡 한 자리에 걸리는 자국을 찾는다 — 지우개용.
 *
 * 선은 점을 이은 것이라 '선까지의 거리' 를 재야 한다. 점만 비교하면 길게 그은
 * 선의 가운데를 눌렀을 때 아무것도 안 걸린다.
 *
 * 좌표는 전부 0~1. 세로로 눌린 만큼 가로도 같은 비율로 보이게 하려면 화면
 * 비율을 넘겨야 하지만, 형광펜은 굵어서 그 정도 오차는 문제가 안 된다.
 */
export function markAt(marks: PatternMark[], x: number, y: number, tolerance: number): PatternMark | null {
  let best: PatternMark | null = null;
  // ⚠️ 여기서 tolerance 로 시작하면 안 된다. 굵게 그은 자국은 tolerance 보다
  //    멀리서도 걸려야 하는데, 그 값으로 시작하면 '가장 가까운 것' 비교에서
  //    먼저 걸러져 영영 안 골라진다.
  let bestD = Infinity;
  for (const m of marks) {
    const d = distanceToStroke(m.points, x, y);
    // 눈에 보이는 굵기만큼은 눌러서 지울 수 있어야 한다
    const reach = Math.max(tolerance, m.width / 2);
    if (d <= reach && d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

/** 점 (x,y) 에서 이어진 선까지의 가장 짧은 거리 */
export function distanceToStroke(points: number[], x: number, y: number): number {
  if (points.length < 2) return Infinity;
  if (points.length === 2) return Math.hypot(points[0] - x, points[1] - y);
  let min = Infinity;
  for (let i = 0; i + 3 < points.length; i += 2) {
    min = Math.min(min, distanceToSegment(x, y, points[i], points[i + 1], points[i + 2], points[i + 3]));
  }
  return min;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  // 두 끝점이 같으면 그냥 점까지의 거리
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  // 선 위로 내린 발이 선 밖으로 나가면 가까운 끝점으로 자른다
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * 그리는 동안 쌓인 점을 솎아낸다.
 *
 * 손가락은 1초에 수십 번 자리를 알려 준다. 그대로 담으면 짧은 밑줄 하나에
 * 점이 수백 개가 되어 저장도 그리기도 무거워진다. 앞 점에서 이만큼은
 * 떨어져야 새 점으로 친다.
 */
export const MIN_POINT_GAP = 0.004;

export function shouldAddPoint(points: number[], x: number, y: number): boolean {
  if (points.length < 2) return true;
  const lx = points[points.length - 2];
  const ly = points[points.length - 1];
  return Math.hypot(x - lx, y - ly) >= MIN_POINT_GAP;
}
