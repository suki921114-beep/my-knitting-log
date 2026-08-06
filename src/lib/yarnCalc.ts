import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export function useYarnRemaining(yarnId?: number) {
  return useLiveQuery(async () => {
    if (!yarnId) return null;
    const yarn = await db.yarns.get(yarnId);
    if (!yarn || yarn.isDeleted) return null;
    const links = await db.projectYarns.where('yarnId').equals(yarnId).toArray();
    const used = links.reduce((s, l) => s + (l.usedGrams || 0), 0);
    return { total: yarn.totalGrams, used, remaining: yarn.totalGrams - used };
  }, [yarnId]);
}

export function useAllYarnStats() {
  return useLiveQuery(async () => {
    const yarns = (await db.yarns.toArray()).filter(y => !y.isDeleted);
    const links = await db.projectYarns.toArray();
    const usedByYarn = new Map<number, number>();
    for (const l of links) usedByYarn.set(l.yarnId, (usedByYarn.get(l.yarnId) || 0) + (l.usedGrams || 0));
    return yarns.map(y => {
      const used = usedByYarn.get(y.id!) || 0;
      return { yarn: y, used, remaining: y.totalGrams - used };
    });
  }, []);
}

/**
 * 무게(g)를 길이(m)로 바꾼다.
 *
 * 콘사는 라벨에 총 길이가 안 적혀 있는 경우가 많아, 100g 당 길이만 알면
 * 남은 무게에서 남은 길이를 바로 알 수 있다. 도안이 요구하는 실 길이와
 * 맞춰볼 때 손으로 계산하지 않아도 되게 하려는 것.
 *
 * 기준값이 없거나 0 이하면 null — 계산할 수 없다는 뜻이고, 화면에서는 아예
 * 감춘다. 0m 라고 적으면 실이 없다는 뜻으로 잘못 읽힌다.
 */
export function gramsToMeters(grams: number, metersPer100g?: number): number | null {
  if (!metersPer100g || metersPer100g <= 0) return null;
  if (!Number.isFinite(grams) || grams < 0) return null;
  return (grams * metersPer100g) / 100;
}

/** 길이를 사람이 읽기 좋게 — 1000m 이 넘으면 km 로 접는다 */
export function formatMeters(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 1 : 2)}km`;
  return `${Math.round(m)}m`;
}

export function statusLabel(s: string) {
  return ({ planned: '예정', in_progress: '진행중', done: '완성', on_hold: '보류' } as any)[s] || s;
}

export function statusColor(s: string) {
  return ({
    planned: 'bg-status-planned-bg text-status-planned-fg',
    in_progress: 'bg-status-progress-bg text-status-progress-fg',
    done: 'bg-status-done-bg text-status-done-fg',
    on_hold: 'bg-status-hold-bg text-status-hold-fg',
  } as any)[s] || 'bg-muted text-muted-foreground';
}
