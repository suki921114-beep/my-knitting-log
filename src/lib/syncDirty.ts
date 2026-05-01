// ----------------------------------------------------------------------------
// syncDirty — "백업 필요" 상태 추적 (reason + dirtyAt)
// ----------------------------------------------------------------------------
// 사용자가 로컬 데이터를 변경하면 dirty=true 로 표시하고, useAutoSync 가
// reason 에 따라 debounce / maxWait 를 다르게 적용해 자동 백업을 트리거한다.
//
// reason 별 권장 일정 (useAutoSync 에서 사용):
//   - 'rowCounter'  : 빠르게 자주 바뀜 → debounce 3s, maxWait 15s
//   - 그 외          : 일반 entity     → debounce 15s, maxWait 60s
//
// 자동/수동 백업이나 가져오기 실행 중에 발생하는 내부 write 는 dirty 로 잡지
// 않도록 syncRunner.beginSyncRun() 이 자동으로 pauseDirtyTracking() 을 호출한다.

import type Dexie from 'dexie';
import type { Table } from 'dexie';

const DIRTY_KEY = 'syncDirty.v1';
const DIRTY_AT_KEY = 'syncDirtyAt.v1';
const LAST_AUTO_BACKUP_KEY = 'lastAutoBackupAt.v1';

export type DirtyReason = 'rowCounter' | 'projectGauge' | 'project' | 'library';

let _dirty = false;
let _dirtyAt = 0; // 처음 dirty 가 켜진 시각 (Date.now()) — maxWait 계산용
let _latestReason: DirtyReason | null = null;
let _pauseDepth = 0;
const _listeners = new Set<(dirty: boolean) => void>();

// ---- 초기 상태 복원 ----
try {
  _dirty = localStorage.getItem(DIRTY_KEY) === '1';
  if (_dirty) {
    const raw = localStorage.getItem(DIRTY_AT_KEY);
    _dirtyAt = raw ? Number(raw) || Date.now() : Date.now();
  }
} catch {
  // ignore
}

function persistDirty(value: boolean, atMs: number) {
  try {
    if (value) {
      localStorage.setItem(DIRTY_KEY, '1');
      localStorage.setItem(DIRTY_AT_KEY, String(atMs));
    } else {
      localStorage.removeItem(DIRTY_KEY);
      localStorage.removeItem(DIRTY_AT_KEY);
    }
  } catch {
    // ignore
  }
}

function notify() {
  for (const l of _listeners) {
    try {
      l(_dirty);
    } catch (e) {
      console.error('[syncDirty] listener 예외:', e);
    }
  }
}

// ============================================================================
// public API
// ============================================================================

export function hasSyncDirty(): boolean {
  return _dirty;
}

/**
 * dirty 가 처음 켜진 시각. clear 시 0.
 * useAutoSync 에서 maxWait 잔여 시간 계산에 사용.
 */
export function getDirtyAt(): number {
  return _dirtyAt;
}

/**
 * 가장 최근에 mark 된 reason. clear 시 null.
 * useAutoSync 에서 reason 별 debounce/maxWait 선택에 사용.
 */
export function getLatestDirtyReason(): DirtyReason | null {
  return _latestReason;
}

export function markSyncDirty(reason: DirtyReason) {
  if (_pauseDepth > 0) return; // 백업/가져오기 중에는 무시
  _latestReason = reason;
  if (_dirty) {
    // 이미 dirty — listener 통지만 (reason 갱신 알림 효과)
    notify();
    return;
  }
  _dirty = true;
  _dirtyAt = Date.now();
  persistDirty(true, _dirtyAt);
  notify();
}

export function clearSyncDirty() {
  if (!_dirty && _latestReason === null) return;
  _dirty = false;
  _dirtyAt = 0;
  _latestReason = null;
  persistDirty(false, 0);
  notify();
}

export function subscribeSyncDirty(listener: (dirty: boolean) => void): () => void {
  _listeners.add(listener);
  // 즉시 현재 상태 1회 통지 (편의)
  try { listener(_dirty); } catch {}
  return () => { _listeners.delete(listener); };
}

export function pauseDirtyTracking() {
  _pauseDepth++;
}

export function resumeDirtyTracking() {
  if (_pauseDepth > 0) _pauseDepth--;
}

export function isDirtyTrackingPaused(): boolean {
  return _pauseDepth > 0;
}

// ============================================================================
// 마지막 자동 백업 시각
// ============================================================================

export function getLastAutoBackupAt(): string | null {
  try {
    return localStorage.getItem(LAST_AUTO_BACKUP_KEY);
  } catch {
    return null;
  }
}

export function setLastAutoBackupAt(iso: string) {
  try {
    localStorage.setItem(LAST_AUTO_BACKUP_KEY, iso);
  } catch {
    // ignore
  }
}

// ============================================================================
// Dexie hooks 등록 — 테이블별 reason 매핑
// ============================================================================

const TABLE_REASON: Record<string, DirtyReason> = {
  // 자주 바뀜 (단수 카운터)
  rowCounters: 'rowCounter',
  // 프로젝트의 게이지
  projectGauges: 'projectGauge',
  // 프로젝트 본문 + 연결 테이블
  projects: 'project',
  projectYarns: 'project',
  projectPatterns: 'project',
  projectNeedles: 'project',
  projectNotions: 'project',
  // 라이브러리 (실/도안/바늘/부자재)
  yarns: 'library',
  patterns: 'library',
  needles: 'library',
  notions: 'library',
};

let _hooksAttached = false;

export function attachDirtyHooks(db: Dexie) {
  if (_hooksAttached) return;
  _hooksAttached = true;

  for (const [name, reason] of Object.entries(TABLE_REASON)) {
    const table: Table<any> | undefined = (db as any)[name];
    if (!table || typeof table.hook !== 'function') continue;

    table.hook('creating', () => { markSyncDirty(reason); });
    table.hook('updating', () => { markSyncDirty(reason); });
    table.hook('deleting', () => { markSyncDirty(reason); });
  }
}
