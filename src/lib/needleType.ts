// ----------------------------------------------------------------------------
// 바늘 종류
// ----------------------------------------------------------------------------
// 예전에는 종류를 그냥 글로 적게 했다. 그러다 보니 '대바늘'과 '대 바늘' 이
// 다른 종류로 갈라지고, 오타 하나에 묶여야 할 것이 흩어졌다.
// 그래서 큰 갈래는 고르게 하고, 대바늘만 세부 갈래를 둔다.
//
//   대바늘 ─ 줄바늘 / 조립식 ─ 숏팁 / 롱팁
//   코바늘
//   장갑바늘
//   기타 ─ 직접 적기
//
// ⚠️ 옛 데이터에는 '줄바늘' 이 큰 갈래로 저장돼 있다.
//    읽을 때 대바늘 + 줄바늘로 풀어 준다. 기존 기록을 건드리지 않고도
//    새 화면에서 제자리를 찾게 하려는 것 — 다음에 저장하면 정식으로 바뀐다.

export const NEEDLE_KINDS = ['대바늘', '코바늘', '장갑바늘', '기타'] as const;
export type NeedleKind = (typeof NEEDLE_KINDS)[number];

export const NEEDLE_SUBTYPES = ['줄바늘', '조립식'] as const;
export type NeedleSubType = (typeof NEEDLE_SUBTYPES)[number];

export const NEEDLE_TIPS = ['숏팁', '롱팁'] as const;
export type NeedleTip = (typeof NEEDLE_TIPS)[number];

/** 세부 갈래가 있는 종류는 대바늘뿐이다 */
export function hasSubType(kind: NeedleKind): boolean {
  return kind === '대바늘';
}

export interface NeedleShape {
  kind: NeedleKind;
  /** kind 가 '기타' 일 때 사용자가 직접 적은 말 */
  custom?: string;
  subType?: NeedleSubType;
  tip?: NeedleTip;
}

interface StoredNeedle {
  type?: string;
  subType?: string;
  tipLength?: string;
}

function asSubType(v?: string): NeedleSubType | undefined {
  return (NEEDLE_SUBTYPES as readonly string[]).includes(v ?? '') ? (v as NeedleSubType) : undefined;
}

function asTip(v?: string): NeedleTip | undefined {
  return (NEEDLE_TIPS as readonly string[]).includes(v ?? '') ? (v as NeedleTip) : undefined;
}

/** 저장된 값을 화면에서 쓰는 모양으로 푼다 */
export function readNeedle(n: StoredNeedle): NeedleShape {
  const type = (n.type ?? '').trim();
  const subType = asSubType(n.subType);
  const tip = asTip(n.tipLength);

  // 옛 데이터 — '줄바늘' 이 큰 갈래로 저장돼 있던 시절
  if (type === '줄바늘') {
    return { kind: '대바늘', subType: subType ?? '줄바늘', tip };
  }
  if (type === '대바늘') return { kind: '대바늘', subType, tip };
  if (type === '코바늘') return { kind: '코바늘' };
  if (type === '장갑바늘') return { kind: '장갑바늘' };

  // 그 밖에는 전부 기타. 적어둔 말은 버리지 않는다.
  return { kind: '기타', custom: type || undefined };
}

/** 화면 모양을 저장할 값으로 되돌린다 */
export function writeNeedle(shape: NeedleShape): Required<Pick<StoredNeedle, 'type'>> & StoredNeedle {
  if (shape.kind === '기타') {
    return { type: shape.custom?.trim() || '기타', subType: undefined, tipLength: undefined };
  }
  if (shape.kind !== '대바늘') {
    // 세부 갈래가 없는 종류는 남은 값을 지운다. 안 지우면 대바늘에서 옮겨온
    // '숏팁' 같은 값이 코바늘에 남아 화면에 엉뚱하게 나온다.
    return { type: shape.kind, subType: undefined, tipLength: undefined };
  }
  return { type: '대바늘', subType: shape.subType, tipLength: shape.tip };
}

/**
 * 갈래를 앞에서부터 늘어놓는다 — ['대바늘', '조립식', '숏팁']
 * 화면에서 사이 기호에 다른 색을 주려면 이 조각들이 필요하다.
 */
export function needleParts(n: StoredNeedle): string[] {
  const s = readNeedle(n);
  const head = s.kind === '기타' ? s.custom || '기타' : s.kind;
  return [head, s.subType, s.tip].filter((v): v is string => !!v);
}

/**
 * '대바늘 | 조립식 | 숏팁' 처럼 한 줄로.
 *
 * 가운뎃점(·)을 쓰다가 세로줄(|)로 바꿨다. 점은 글자 사이에 파묻혀서
 * 어디서 갈래가 끊기는지 눈에 안 들어온다.
 */
export function describeNeedle(n: StoredNeedle): string {
  return needleParts(n).join(' | ');
}

/** 목록에서 갈래별로 묶을 때 쓰는 값 */
export function needleKindOf(n: StoredNeedle): NeedleKind {
  return readNeedle(n).kind;
}

/**
 * 호수 칸에 적힌 글을 하나씩 끊는다.
 *
 * 조립식 세트는 팁이 열 쌍 넘게 들어 있는데, 한 줄로 뭉개면 "3.75mm 있었나?"
 * 를 알 수 없다. 그렇다고 열 번 입력하게 하는 것도 못 할 짓이다.
 * 그래서 '3.5, 3.75, 4' 처럼 적으면 각각 한 줄로 만들어 준다.
 *
 * 범위(3~8mm)로 받지 않는 이유 — 세트마다 들어 있는 호수가 제각각이다.
 * 어떤 세트는 3.75가 있고 어떤 세트는 3.5 다음이 바로 4다.
 * 범위로 적으면 없는 바늘을 있다고 적게 된다.
 */
export function splitSizes(raw: string): string[] {
  return raw
    .split(/[,、/\n]/)
    .map(s => s.trim())
    .filter(Boolean);
}
