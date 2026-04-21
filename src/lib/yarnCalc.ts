import { useLiveQuery } from 'dexie-react-hooks';
import { db, Yarn } from './db';

export function useYarnRemaining(yarnId?: number) {
  return useLiveQuery(async () => {
    if (!yarnId) return null;
    const yarn = await db.yarns.get(yarnId);
    if (!yarn) return null;
    const links = await db.projectYarns.where('yarnId').equals(yarnId).toArray();
    const used = links.reduce((s, l) => s + (l.usedGrams || 0), 0);
    return { total: yarn.totalGrams, used, remaining: yarn.totalGrams - used };
  }, [yarnId]);
}

export function useAllYarnStats() {
  return useLiveQuery(async () => {
    const yarns = await db.yarns.toArray();
    const links = await db.projectYarns.toArray();
    const usedByYarn = new Map<number, number>();
    for (const l of links) usedByYarn.set(l.yarnId, (usedByYarn.get(l.yarnId) || 0) + (l.usedGrams || 0));
    return yarns.map(y => {
      const used = usedByYarn.get(y.id!) || 0;
      return { yarn: y, used, remaining: y.totalGrams - used };
    });
  }, []);
}

export function statusLabel(s: string) {
  return ({ planned: '예정', in_progress: '진행중', done: '완성', on_hold: '보류' } as any)[s] || s;
}

export function statusColor(s: string) {
  return ({
    planned: 'bg-secondary text-secondary-foreground',
    in_progress: 'bg-accent/15 text-accent',
    done: 'bg-sage/20 text-foreground',
    on_hold: 'bg-muted text-muted-foreground',
  } as any)[s] || 'bg-muted';
}
