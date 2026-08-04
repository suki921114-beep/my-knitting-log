// ----------------------------------------------------------------------------
// 뜨개 기록 헬퍼
// ----------------------------------------------------------------------------

import { db, now, KnitLog, ProjectPhoto } from '@/lib/db';

/** 'YYYY-MM-DD' (로컬 기준) */
export function todayStr(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** '8월 4일 (월)' 처럼 사람이 읽는 날짜 */
export function formatLogDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const today = todayStr();
  const yesterday = todayStr(new Date(Date.now() - 86400000));
  if (date === today) return '오늘';
  if (date === yesterday) return '어제';
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}

/** 날짜별로 묶기 (최신순) */
export function groupByDate(logs: KnitLog[]): { date: string; items: KnitLog[] }[] {
  const map = new Map<string, KnitLog[]>();
  for (const l of logs) {
    if (!map.has(l.date)) map.set(l.date, []);
    map.get(l.date)!.push(l);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => b.createdAt - a.createdAt),
    }));
}

export interface SaveLogInput {
  id?: number;
  projectId?: number;
  date: string;
  text: string;
  rows?: number;
  mood?: string;
  photos?: ProjectPhoto[];
}

export async function saveLog(input: SaveLogInput): Promise<number> {
  const t = now();
  const payload = {
    projectId: input.projectId,
    date: input.date,
    text: input.text.trim(),
    rows: input.rows,
    mood: input.mood,
    photos: input.photos?.length ? input.photos : undefined,
    updatedAt: t,
    isDeleted: false,
    deletedAt: null,
  };

  if (input.id) {
    await db.logs.update(input.id, payload);
    return input.id;
  }
  return (await db.logs.add({
    ...payload,
    createdAt: t,
    cloudId: crypto.randomUUID(),
  } as KnitLog)) as number;
}

/** soft delete */
export async function deleteLog(id: number) {
  const t = now();
  await db.logs.update(id, { isDeleted: true, deletedAt: t, updatedAt: t } as any);
}

export async function restoreLog(id: number) {
  const t = now();
  await db.logs.update(id, { isDeleted: false, deletedAt: null, updatedAt: t } as any);
}
