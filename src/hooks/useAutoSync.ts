// ----------------------------------------------------------------------------
// useAutoSync — 변경 감지 기반 자동 백업 (reason별 debounce + maxWait)
// ----------------------------------------------------------------------------
// 단수 카운터(rowCounter)는 뜨개 중 빠르게 여러 번 바뀌므로 짧은 debounce 로
// 거의 실시간처럼 백업하되, 계속 바뀌더라도 maxWait 안에는 한 번 밀어 올린다.
// 일반 entity 는 더 느슨한 debounce 로 묶어서 한 번에 백업.
//
// reason 별 일정:
//   rowCounter → debounce 3s,  maxWait 15s
//   그 외       → debounce 15s, maxWait 60s
//
// debounce: 새 변경 들어올 때마다 리셋 (마지막 변경 후 N초 조용해야 발사)
// maxWait : 처음 dirty 가 켜진 시점부터 N초 지나면 강제 발사
//           (계속 카운터를 누르고 있어도 주기적으로 백업되도록 보장)
//
// 추가:
//   - 앱 마운트 시 dirty 가 이미 있다면 INITIAL_DELAY 후 1회
//   - visibilitychange (hidden) / pagehide → 즉시 fire 시도
//     ("탭 닫기 직전에 마지막 백업" 케이스)

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/sonner';
import {
  getAutoSyncMode,
  shouldAutoSync,
  runFullSync,
  saveLastResult,
  beginSyncRun,
  endSyncRun,
} from '@/lib/syncRunner';
import {
  hasSyncDirty,
  clearSyncDirty,
  subscribeSyncDirty,
  setLastAutoBackupAt,
  getDirtyAt,
  getLatestDirtyReason,
  type DirtyReason,
} from '@/lib/syncDirty';

const INITIAL_DELAY_MS = 5000;

const ROWCOUNTER_DEBOUNCE_MS = 3000;
const ROWCOUNTER_MAXWAIT_MS = 15000;
const GENERAL_DEBOUNCE_MS = 15000;
const GENERAL_MAXWAIT_MS = 60000;

function pickSchedule(reason: DirtyReason | null) {
  if (reason === 'rowCounter') {
    return { debounceMs: ROWCOUNTER_DEBOUNCE_MS, maxWaitMs: ROWCOUNTER_MAXWAIT_MS };
  }
  return { debounceMs: GENERAL_DEBOUNCE_MS, maxWaitMs: GENERAL_MAXWAIT_MS };
}

export function useAutoSync() {
  const { user, loading } = useAuth();

  const userRef = useRef(user);
  userRef.current = user;

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialFiredRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    // ---- 자동 백업 1회 실행 함수 ----
    const runOnce = async () => {
      // 두 timer 모두 clear (어느 쪽이 먼저 발사되든 다른 쪽도 무효화)
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      if (maxWaitTimer.current) {
        clearTimeout(maxWaitTimer.current);
        maxWaitTimer.current = null;
      }

      // 다시 한 번 조건 확인
      const mode = getAutoSyncMode();
      if (!shouldAutoSync(mode)) return;
      if (!hasSyncDirty()) return;
      if (!userRef.current) return;

      // sync lock — 수동 백업/가져오기 진행 중이면 다음 dirty 변경 때 다시 시도됨
      if (!beginSyncRun()) return;
      try {
        const { result, failed } = await runFullSync(userRef.current.uid);
        saveLastResult(result);

        const totalChanged = result.entries.reduce(
          (acc, e) => acc + (e.stat as any).uploaded + (e.stat as any).downloaded,
          0,
        );

        if (failed === 0) {
          clearSyncDirty();
          setLastAutoBackupAt(new Date().toISOString());

          if (totalChanged > 0) {
            toast.success('자동 백업 완료', {
              description: `${totalChanged}건이 클라우드와 동기화됐어요.`,
            });
          }
          // 변화 0건이면 토스트 생략 (조용히)
        } else {
          // dirty 유지 → 다음 변경/실행 때 재시도
          toast.warning('자동 백업 일부 실패', {
            description: `변경 ${totalChanged}건 / 실패 ${failed}건. 설정 페이지의 결과 카드에서 확인하세요.`,
          });
        }
      } catch (e) {
        console.error('[AutoSync] 실패:', e);
        toast.error('자동 백업 실패', {
          description: '네트워크 또는 권한 문제일 수 있어요.',
        });
        // dirty 유지
      } finally {
        endSyncRun();
      }
    };

    // ---- reason 기반 timer 스케줄링 ----
    const reschedule = (reason: DirtyReason | null) => {
      const mode = getAutoSyncMode();
      if (!shouldAutoSync(mode)) return;
      if (!hasSyncDirty()) return;

      const { debounceMs, maxWaitMs } = pickSchedule(reason);

      // debounce — 매 변경마다 reset
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(runOnce, debounceMs);

      // maxWait — 처음 dirty 시각 기준 잔여 시간 계산 후 한 번만 set
      if (!maxWaitTimer.current) {
        const dirtyAt = getDirtyAt() || Date.now();
        const elapsed = Date.now() - dirtyAt;
        const remaining = Math.max(0, maxWaitMs - elapsed);
        maxWaitTimer.current = setTimeout(runOnce, remaining);
      }
    };

    // ---- 1) 앱 마운트 시 한 번 ----
    if (!initialFiredRef.current) {
      initialFiredRef.current = true;

      const mode = getAutoSyncMode();
      if (shouldAutoSync(mode) && hasSyncDirty()) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(runOnce, INITIAL_DELAY_MS);
      }
    }

    // ---- 2) dirty 변경 구독 ----
    let firstNotify = true;
    const unsub = subscribeSyncDirty((dirty) => {
      if (firstNotify) {
        firstNotify = false;
        return;
      }
      if (!dirty) return; // false → clear 된 것이므로 트리거 X
      reschedule(getLatestDirtyReason());
    });

    // ---- 3) visibilitychange / pagehide → 즉시 백업 시도 ----
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      const mode = getAutoSyncMode();
      if (!shouldAutoSync(mode)) return;
      if (!hasSyncDirty()) return;
      // 즉시 fire — 탭이 곧 멈출 수 있으니 timer 대기 안 함
      runOnce();
    };
    const onPageHide = () => {
      const mode = getAutoSyncMode();
      if (!shouldAutoSync(mode)) return;
      if (!hasSyncDirty()) return;
      runOnce();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      if (maxWaitTimer.current) {
        clearTimeout(maxWaitTimer.current);
        maxWaitTimer.current = null;
      }
    };
  }, [user, loading]);
}
