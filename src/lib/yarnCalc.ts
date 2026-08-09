import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Yarn, YarnRecommendation } from './db';

/**
 * 남은 양.
 *
 * '다 썼어요' 를 켜면 계산과 상관없이 0 이다. 사용량을 g 단위로 정확히 적는
 * 사람은 드물고, 자투리는 그냥 버리기도 한다. 사람이 끝났다고 하면 끝난 것이다.
 */
export function remainingGrams(yarn: Pick<Yarn, 'totalGrams' | 'usedUp'>, used: number): number {
  if (yarn.usedUp) return 0;
  return yarn.totalGrams - used;
}

export function useYarnRemaining(yarnId?: number) {
  return useLiveQuery(async () => {
    if (!yarnId) return null;
    const yarn = await db.yarns.get(yarnId);
    if (!yarn || yarn.isDeleted) return null;
    const links = await db.projectYarns.where('yarnId').equals(yarnId).toArray();
    const used = links.reduce((s, l) => s + (l.usedGrams || 0), 0);
    return { total: yarn.totalGrams, used, remaining: remainingGrams(yarn, used) };
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
      return { yarn: y, used, remaining: remainingGrams(y, used) };
    });
  }, []);
}

// ----------------------------------------------------------------------------
// 실을 적을 때 고르는 값들
// ----------------------------------------------------------------------------
// 글로 적게 두면 '핑거링' 과 '핑거링사' 가 다른 굵기로 갈라진다.
// 바늘 종류에서 겪은 것과 같은 문제라 처음부터 골라 담게 한다.
// 다만 목록에 없는 실도 있으니 직접 적는 길은 남긴다.

/** 흔히 쓰는 굵기 — 가는 것부터 */
export const YARN_WEIGHTS = [
  '레이스',
  '핑거링',
  '스포츠',
  'DK',
  '워스티드',
  '아란',
  '벌키',
  '슈퍼벌키',
] as const;

/** 실을 만든 방식 */
export const YARN_DYE_TYPES = ['일반실', '염색실'] as const;

/** 어떤 뜨기로 잰 게이지인지 */
export const GAUGE_PATTERNS = ['무메', '무늬'] as const;

/**
 * 다 쓴 실인지.
 *
 * 직접 '다 썼어요' 를 눌렀거나, 계산상 남은 양이 없거나. 둘 다 끝난 실이다.
 */
export function isUsedUp(yarn: Pick<Yarn, 'usedUp'>, remaining: number): boolean {
  return !!yarn.usedUp || remaining <= 0;
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

/**
 * 합수별 권장값을 꺼낸다.
 *
 * 예전에는 권장 바늘·게이지가 한 줄뿐이었다. 그때 적어둔 값은 1합 기준으로
 * 보고 첫 줄에 놓는다. 데이터를 통째로 옮기는 대신 읽을 때 맞춰주는 쪽을
 * 골랐다 — 기기마다 옮기는 시점이 어긋나면 클라우드에서 부딪힌다.
 *
 * 합수 오름차순으로 정렬해서 돌려준다.
 */
export function yarnRecommendations(yarn: Pick<Yarn, 'recommendations' | 'needleSize' | 'gauge'>): YarnRecommendation[] {
  if (yarn.recommendations?.length) {
    return [...yarn.recommendations].sort((a, b) => a.strands - b.strands);
  }
  if (yarn.needleSize || yarn.gauge) {
    return [{ strands: 1, needleSize: yarn.needleSize, gauge: yarn.gauge }];
  }
  return [];
}

/**
 * 길이 표기 — 언제나 미터로.
 *
 * km 로 접으면 목록에서 어떤 실은 m, 어떤 실은 km 로 나와 한눈에 비교가 안 된다.
 * 실은 도안이 요구하는 미터수와 견주는 값이라 단위가 흔들리면 안 된다.
 * 대신 자릿수가 길어지므로 천 단위로 끊어 준다.
 */
export function formatMeters(m: number): string {
  return `${Math.round(m).toLocaleString('ko-KR')}m`;
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
