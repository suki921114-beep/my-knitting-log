// ----------------------------------------------------------------------------
// syncDirty — "백업 필요" 상태 추적
// ----------------------------------------------------------------------------
// 사용자가 로컬 데이터를 변경하면 dirty=true 로 표시하고,
// useAutoSync 가 이걸 구독해서 debounce 후 자동 백업을 트리거한다.
//
// 자동/수동 백업이나 가져오기 실행 중에 발생하는 내부 write 는 dirty 로 잡지
// 않도록 syncRunner.beginSyncRun() 이 자동으로 pauseDirtyTracking() 을 호출한다.
//
// import 방향: syncDirty → db (hook 등록만), 다른 모듈은 syncDirty 만 import.

import type Dexie from 'dexie';
import type { Table } from 'dexie';

const DIRTY_KEY = 'syncDirty.v1';
const LAST_AUTO_BACKUP_KEY = 'lastAutoBackupAt.v1';

let _dirty = false;
let _pauseDepth = 0; // pause/resume 중첩 카운터
const _listeners = new Set<(dirty: boolean) => void>();

// ---- 초기 상태 복원 ----
try {
  _dirty = localStorage.getItem(DIRTY_KEY) === '1';
} catch {
  // ignore
}

function persistDirty(value: boolean) {
  try {
    if (value) localStorage.setItem(DIRTY_KEY, '1');
    else localStorage.removeItem(DIRTY_KEY);
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

export function markSyncDirty(reason?: string) {
  if (_pauseDepth > 0) return; // 백업/가져오기 중에는 무시
  if (_dirty) return; // 이미 표시됨
  _dirty = true;
  persistDirty(true);
  if (reason) console.debug(`[syncDirty] mark (${reason})`);
  notify();
}

export function clearSyncDirty() {
  if (!_dirty) return;
  _dirty = false;
  persistDirty(false);
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
// Dexie hooks 등록
// ----------------------------------------------------------------------------
// db.ts 의 KnitDB 인스턴스에 한 번만 호출.
// 동기화 대상 테이블에 creating/updating/deleting 후크를 달아
// 사용자 변경을 감지한다 (pause 중이면 무시됨).
// ============================================================================

const TARGET_TABLES = [
  'yarns',
  'patterns',
  'needles',
  'notions',
  'projects',
  'projectYarns',
  'projectPatterns',
  'projectNeedles',
  'projectNotions',
  'rowCounters',
  'projectGauges',
] as const;

let _hooksAttached = false;

export function attachDirtyHooks(db: Dexie) {
  if (_hooksAttached) return;
  _hooksAttached = true;

  for (const name of TARGET_TABLES) {
    const table: Table<any> | undefined = (db as any)[name];
    if (!table || typeof table.hook !== 'function') continue;

    table.hook('creating', () => {
      markSyncDirty(`${name}:create`);
    });
    table.hook('updating', () => {
      markSyncDirty(`${name}:update`);
    });
    table.hook('deleting', () => {
      markSyncDirty(`${name}:delete`);
    });
  }
}
