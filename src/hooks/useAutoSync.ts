// ----------------------------------------------------------------------------
// useAutoSync — 변경 감지 기반 자동 백업
// ----------------------------------------------------------------------------
// 동작 흐름:
//
//   1) 앱 마운트 시 dirty 가 true 이고 모든 조건이 충족되면 ~5초 뒤 1회 자동 백업
//      ("앱을 다시 켰는데 백업 안 한 변경이 있더라" 케이스)
//
//   2) 사용 중 dirty 가 새로 true 가 되면 debounce 후 자동 백업
//      카운터 +1 을 빠르게 여러 번 눌러도 timer 가 reset 되어 한 번만 실행됨
//
//   3) 백업 성공 → clearSyncDirty + lastAutoBackupAt 저장 + 토스트
//      백업 실패 → dirty 유지 + 에러 토스트 (다음 변경 또는 다음 실행 때 재시도)

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
} from '@/lib/syncDirty';

// 앱 첫 진입 (마운트) 시 무거운 네트워크 작업 회피용 짧은 지연
const INITIAL_DELAY_MS = 5000;

// 사용 중 변경이 발생한 뒤 debounce 간격
// (단수 카운터 등 빠른 연속 변경을 한 번의 백업으로 합치는 용도)
const CHANGE_DEBOUNCE_MS = 15000;

export function useAutoSync() {
  const { user, loading } = useAuth();

  const userRef = useRef(user);
  userRef.current = user;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialFiredRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    // ---- 자동 백업 1회 실행 함수 ----
    const runOnce = async () => {
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
        } else {
          // 일부 실패 → dirty 유지 (다음 변경이나 재시도 때 다시 시도)
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

    const schedule = (delayMs: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        runOnce();
      }, delayMs);
    };

    // ---- 1) 앱 마운트 시 한 번 ----
    if (!initialFiredRef.current) {
      initialFiredRef.current = true;

      const mode = getAutoSyncMode();
      if (shouldAutoSync(mode) && hasSyncDirty()) {
        schedule(INITIAL_DELAY_MS);
      }
    }

    // ---- 2) dirty 변경 구독 (debounce) ----
    let firstNotify = true;
    const unsub = subscribeSyncDirty((dirty) => {
      if (firstNotify) {
        firstNotify = false;
        return;
      }
      if (!dirty) return;
      const mode = getAutoSyncMode();
      if (!shouldAutoSync(mode)) return;
      schedule(CHANGE_DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [user, loading]);
}
