// ----------------------------------------------------------------------------
// useAutoSync — 자동 백업 트리거 훅
// ----------------------------------------------------------------------------
// AppLayout 에서 호출되어 다음 조건을 모두 만족하면
// 앱 마운트 직후 한 번만 자동 동기화를 실행한다:
//
//   1) 사용자가 로그인되어 있음
//   2) 자동 동기화 모드가 'wifi' 또는 'always'
//   3) 'wifi' 모드일 경우 현재 네트워크가 Wi-Fi (또는 알 수 없는 환경에서는 false)
//   4) navigator.onLine === true
//
// 같은 세션에서 두 번 트리거되지 않도록 ref 로 가드.
// 결과는 LastResult 로 저장되어 설정 페이지의 결과 카드에서 확인할 수 있다.

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

// 앱이 안정된 뒤에 트리거 (UI 렌더 직후 무거운 네트워크 작업 회피)
const AUTO_DELAY_MS = 4000;

export function useAutoSync() {
  const { user, loading } = useAuth();
  const triggered = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (triggered.current) return;

    const mode = getAutoSyncMode();
    if (!shouldAutoSync(mode)) return;

    triggered.current = true;

    const timer = setTimeout(async () => {
      // 사용자가 막 [백업] 버튼을 눌렀거나 다른 동기화가 도는 중이면 스킵
      if (!beginSyncRun()) return;
      try {
        const { result, failed } = await runFullSync(user.uid);
        saveLastResult(result);

        const totalChanged = result.entries.reduce(
          (acc, e) =>
            acc + (e.stat as any).uploaded + (e.stat as any).downloaded,
          0,
        );

        // 변화 없으면 조용히 (사용자 흐름 방해 안 함)
        if (totalChanged === 0 && failed === 0) return;

        if (failed > 0) {
          toast.warning('자동 백업 완료 · 일부 실패', {
            description: `변경 ${totalChanged}건 / 실패 ${failed}건. 설정 페이지의 결과 카드에서 확인하세요.`,
          });
        } else {
          toast.success('자동 백업 완료', {
            description: `${totalChanged}건이 클라우드와 동기화됐어요.`,
          });
        }
      } catch (e) {
        console.error('[AutoSync] 실패:', e);
        toast.error('자동 백업 실패', {
          description: '네트워크 또는 권한 문제일 수 있어요.',
        });
      } finally {
        endSyncRun();
      }
    }, AUTO_DELAY_MS);

    return () => clearTimeout(timer);
  }, [user, loading]);
}
