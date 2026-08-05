// ----------------------------------------------------------------------------
// 가져오기 판정 규칙 (순수 함수)
// ----------------------------------------------------------------------------
// 각 entity 의 calculate*FetchDiff 가 같은 규칙을 쓰도록 한 곳에 모으고,
// 테스트로 굳혀 둔다. 규칙이 어긋나면 "지운 게 되살아나는" 종류의 버그가 난다.

export interface FetchCandidate {
  isDeleted?: boolean;
  updatedAt?: number;
}

export type FetchDecision = 'add' | 'update' | 'skip';

/**
 * 원격 레코드를 이 기기에 어떻게 반영할지 정한다.
 *
 * @param remote 클라우드 레코드
 * @param local  같은 cloudId 의 로컬 레코드 (없으면 undefined)
 * @param force  '클라우드 상태로 되돌리기' — 시각 비교를 건너뛴다
 */
export function decideFetch(
  remote: FetchCandidate,
  local: FetchCandidate | undefined,
  force = false,
): FetchDecision {
  // 클라우드에서 이미 지워진 것을, 이 기기에 없는데 새로 만들 이유는 없다.
  // 휴지통을 비운 뒤 가져오기를 하면 되살아나던 원인이 바로 이것이었다.
  // 새 기기에 예전 휴지통이 딸려 오는 것도 함께 막는다.
  if (remote.isDeleted && !local) return 'skip';

  if (!local) return 'add';
  if (force) return 'update';
  return (remote.updatedAt ?? 0) > (local.updatedAt ?? 0) ? 'update' : 'skip';
}
