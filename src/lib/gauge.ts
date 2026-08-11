// ----------------------------------------------------------------------------
// 게이지 — 실과 도안이 함께 쓴다
// ----------------------------------------------------------------------------
// 처음에는 실에만 있었다. 그런데 실제로 쓰는 흐름은 그 반대인 경우가 많다.
// "이 실이 4mm 에 22코 30단이 나오는데, 여기 맞는 도안이 뭐가 있지?"
// 그래서 도안에도 같은 모양으로 붙이고, 양쪽 다 검색으로 찾을 수 있게 한다.
//
// 화면에서는 글자로 다루고 저장할 때 숫자로 바꾼다. 숫자 상태로 들고 있으면
// 빈 칸을 표현할 수 없어서, 지웠는데 0 이 남는 문제가 생긴다.

import type { GaugeSpec } from '@/lib/db';
import { formatNeedleSize } from '@/lib/needleType';

/** 화면에서 들고 있는 모양 — 전부 글자 */
export interface GaugeRow {
  strands: string;
  needleSize: string;
  gauge: string;
  gaugePattern: string;
  washState: string;
}

export function emptyGaugeRow(strands: number): GaugeRow {
  return { strands: String(strands), needleSize: '', gauge: '', gaugePattern: '', washState: '' };
}

export function toGaugeRows(specs: GaugeSpec[] | undefined): GaugeRow[] {
  return (specs ?? []).map(s => ({
    strands: String(s.strands ?? 1),
    needleSize: s.needleSize || '',
    gauge: s.gauge || '',
    gaugePattern: s.gaugePattern || '',
    washState: s.washState || '',
  }));
}

/**
 * 저장할 모양으로 되돌린다.
 * 바늘과 코단을 둘 다 비워둔 줄은 버린다 — 적다 만 줄이다.
 */
export function fromGaugeRows(rows: GaugeRow[]): GaugeSpec[] | undefined {
  const out = rows
    .map(r => ({
      strands: Number(r.strands) || 1,
      needleSize: r.needleSize.trim() || undefined,
      gauge: r.gauge.trim() || undefined,
      gaugePattern: r.gaugePattern || undefined,
      washState: r.washState || undefined,
    }))
    .filter(r => r.needleSize || r.gauge)
    .sort((a, b) => a.strands - b.strands);
  return out.length ? out : undefined;
}

/** 한 줄을 사람이 읽는 말로 — '메리야스 · 세탁 후 · 1겹 · 4.0mm · 22코 30단' */
export function describeGauge(spec: GaugeSpec): string {
  return [
    spec.gaugePattern === '무메' ? '메리야스' : spec.gaugePattern,
    spec.washState,
    spec.strands ? `${spec.strands}겹` : null,
    formatNeedleSize(spec.needleSize),
    spec.gauge,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * 검색에 쓸 글자 뭉치.
 *
 * 사람이 '4' 라고 칠지 '4.0mm' 라고 칠지 알 수 없어서 둘 다 담는다.
 * 마찬가지로 '22코' 만 칠 수도, '22코 30단' 을 통째로 칠 수도 있다.
 * 넉넉히 담아두는 편이 못 찾는 것보다 낫다 — 어차피 목록에서 눈으로 고른다.
 */
export function gaugeSearchText(specs: GaugeSpec[] | undefined): string {
  if (!specs?.length) return '';
  const parts: string[] = [];
  for (const s of specs) {
    if (s.strands) parts.push(`${s.strands}겹`);
    if (s.needleSize) {
      parts.push(s.needleSize);
      parts.push(formatNeedleSize(s.needleSize));
    }
    if (s.gauge) parts.push(s.gauge);
    if (s.gaugePattern) {
      parts.push(s.gaugePattern);
      // 옛 값으로 저장된 것도 새 이름으로 찾히게
      if (s.gaugePattern === '무메') parts.push('메리야스');
    }
    if (s.washState) parts.push(s.washState);
  }
  return parts.join(' ').toLowerCase();
}
