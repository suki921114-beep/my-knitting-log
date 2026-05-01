// ----------------------------------------------------------------------------
// syncRunner — 자동/수동 동기화가 공유하는 헬퍼
// ----------------------------------------------------------------------------
// - AutoSyncMode 저장/판정 (off / wifi / always)
// - 네트워크 상태 (Wi-Fi 여부) 판정
// - 마지막 결과(LastResult) 저장/로드
// - 한 번에 모든 entity를 동기화/가져오는 runFullSync / runFullFetch
//
// Settings 페이지(수동)는 단계별 토스트를 직접 띄우기 때문에
// entity별 함수를 직접 호출하고, runFullSync/Fetch 는 useAutoSync 훅에서 사용.

import {
  calculateYarnSyncDiff, executeYarnSync,
  calculatePatternSyncDiff, executePatternSync,
  calculateNeedleSyncDiff, executeNeedleSync,
  calculateNotionSyncDiff, executeNotionSync,
  calculateProjectSyncDiff, executeProjectSync,
  calculateYarnFetchDiff, executeYarnFetch,
  calculatePatternFetchDiff, executePatternFetch,
  calculateNeedleFetchDiff, executeNeedleFetch,
  calculateNotionFetchDiff, executeNotionFetch,
  calculateProjectFetchDiff, executeProjectFetch,
} from './sync';
import { pauseDirtyTracking, resumeDirtyTracking } from './syncDirty';

// ============================================================================
// 자동 동기화 모드
// ============================================================================

export type AutoSyncMode = 'off' | 'wifi' | 'always';
const AUTO_SYNC_KEY = 'autoSyncMode.v1';

export function getAutoSyncMode(): AutoSyncMode {
  try {
    const v = localStorage.getItem(AUTO_SYNC_KEY);
    if (v === 'wifi' || v === 'always' || v === 'off') return v;
  } catch {
    // localStorage 불가 (시크릿 모드 등) — 기본값 사용
  }
  return 'off';
}

export function setAutoSyncMode(mode: AutoSyncMode) {
  try {
    localStorage.setItem(AUTO_SYNC_KEY, mode);
  } catch {
    // ignore
  }
}

/**
 * 현재 네트워크가 Wi-Fi(혹은 유선)에 가까운지 추정.
 *
 * 브라우저별 Network Information API 차이를 흡수한다:
 * - Chromium 모바일: connection.type 노출 안 됨, effectiveType('4g'/'3g'/...)만 줌
 * - Chromium 데스크톱: connection.type 또는 effectiveType
 * - Firefox/Safari: navigator.connection 자체 없음
 *
 * 정확히 알 수 없을 때는 보수적으로 false (= 셀룰러로 간주). 그래야 'wifi only'
 * 모드가 데이터 환경에서 실수로 자동 동기화하지 않는다.
 */
export function isOnWifi(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn: any =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;

  // navigator.connection 자체가 없으면 — Firefox/Safari 등
  // 이 경우 type 판정이 불가능하므로 사용자가 'always' 가 아니라면 자동 동기화 자제
  if (!conn) return false;

  // 데이터 절약 모드는 셀룰러로 간주
  if (conn.saveData) return false;

  // type 직접 노출되는 환경
  if (conn.type) {
    return ['wifi', 'ethernet', 'wimax', 'unknown'].includes(conn.type);
  }

  // effectiveType 만 있으면 셀룰러일 가능성이 높으므로 보수적으로 false
  if (conn.effectiveType) return false;

  return false;
}

export function shouldAutoSync(mode: AutoSyncMode): boolean {
  if (mode === 'off') return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (mode === 'wifi' && !isOnWifi()) return false;
  return true;
}

// ============================================================================
// 동시 실행 방지 lock
// ----------------------------------------------------------------------------
// 자동 백업과 수동 [백업]/[가져오기] 가 거의 동시에 트리거될 때 한 entity 를
// 두 흐름이 동시에 처리하면 중복/덮어쓰기 위험이 있다. 모듈 스코프 단순 플래그로
// 같은 탭 안의 동시 실행을 막는다 (탭 간 동기화는 별도 레이어 — 향후 BroadcastChannel).
// ============================================================================

let _syncRunning = false;

export function isSyncRunning(): boolean {
  return _syncRunning;
}

/**
 * 동기화 흐름의 시작/끝을 알린다.
 * 사용 패턴:
 *   if (!beginSyncRun()) return;
 *   try { ... } finally { endSyncRun(); }
 */
export function beginSyncRun(): boolean {
  if (_syncRunning) return false;
  _syncRunning = true;
  // 백업/가져오기 중 발생하는 내부 write 는 dirty 로 잡지 않는다
  pauseDirtyTracking();
  return true;
}

export function endSyncRun() {
  if (!_syncRunning) return;
  _syncRunning = false;
  resumeDirtyTracking();
}


// ============================================================================
// 마지막 동기화/가져오기 결과 저장
// ============================================================================

export type EntitySyncStat = {
  uploaded: number;
  downloaded: number;
  unchanged: number;
  failed: number;
};

export type EntityFetchStat = {
  added: number;
  updated: number;
  unchanged: number;
  failed: number;
};

export type LastResult =
  | { mode: 'sync'; at: string; entries: { label: string; stat: EntitySyncStat }[] }
  | { mode: 'fetch'; at: string; entries: { label: string; stat: EntityFetchStat }[] };

const LAST_RESULT_KEY = 'lastSyncResult.v1';

export function loadLastResult(): LastResult | null {
  try {
    const raw = localStorage.getItem(LAST_RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastResult;
  } catch {
    return null;
  }
}

export function saveLastResult(r: LastResult) {
  try {
    localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(r));
  } catch {
    // ignore
  }
}

// ============================================================================
// 한 번에 전체 동기화 / 전체 가져오기 (자동 동기화용)
// ============================================================================

export async function runFullSync(userId: string): Promise<{ result: LastResult; failed: number }> {
  const yarnDiff = await calculateYarnSyncDiff(userId);
  const patternDiff = await calculatePatternSyncDiff(userId);
  const needleDiff = await calculateNeedleSyncDiff(userId);
  const notionDiff = await calculateNotionSyncDiff(userId);
  const projectDiff = await calculateProjectSyncDiff(userId);

  const yarnResult = await executeYarnSync(userId, yarnDiff);
  const patternResult = await executePatternSync(userId, patternDiff);
  const needleResult = await executeNeedleSync(userId, needleDiff);
  const notionResult = await executeNotionSync(userId, notionDiff);
  const projectResult = await executeProjectSync(userId, projectDiff);

  const failed =
    yarnResult.failed +
    patternResult.failed +
    needleResult.failed +
    notionResult.failed +
    projectResult.failed;

  const result: LastResult = {
    mode: 'sync',
    at: new Date().toISOString(),
    entries: [
      { label: '실', stat: yarnResult },
      { label: '도안', stat: patternResult },
      { label: '바늘', stat: needleResult },
      { label: '부자재', stat: notionResult },
      { label: '프로젝트', stat: projectResult },
    ],
  };
  return { result, failed };
}

export async function runFullFetch(userId: string): Promise<{ result: LastResult; failed: number }> {
  const yarnDiff = await calculateYarnFetchDiff(userId);
  const patternDiff = await calculatePatternFetchDiff(userId);
  const needleDiff = await calculateNeedleFetchDiff(userId);
  const notionDiff = await calculateNotionFetchDiff(userId);
  const projectDiff = await calculateProjectFetchDiff(userId);

  const yarnResult = await executeYarnFetch(yarnDiff);
  const patternResult = await executePatternFetch(patternDiff);
  const needleResult = await executeNeedleFetch(needleDiff);
  const notionResult = await executeNotionFetch(notionDiff);
  const projectResult = await executeProjectFetch(projectDiff);

  const failed =
    yarnResult.failed +
    patternResult.failed +
    needleResult.failed +
    notionResult.failed +
    projectResult.failed;

  const result: LastResult = {
    mode: 'fetch',
    at: new Date().toISOString(),
    entries: [
      { label: '실', stat: yarnResult },
      { label: '도안', stat: patternResult },
      { label: '바늘', stat: needleResult },
      { label: '부자재', stat: notionResult },
      { label: '프로젝트', stat: projectResult },
    ],
  };
  return { result, failed };
}
