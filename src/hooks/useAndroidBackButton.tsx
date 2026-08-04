import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from '@/components/ui/sonner';

// ----------------------------------------------------------------------------
// 안드로이드 하드웨어 뒤로가기
// ----------------------------------------------------------------------------
// 기본 동작은 "앱 종료" 라 사용자가 뒤로가기를 누르면 작업 중이던 화면이
// 통째로 닫힌다. 안드로이드 사용자가 가장 습관적으로 누르는 버튼이므로
// 아래 순서로 직접 처리한다.
//
//   1) 열려 있는 다이얼로그/시트가 있으면 그것부터 닫는다
//   2) 앱 안에서 뒤로 갈 화면이 있으면 이전 화면으로
//   3) 첫 화면이면 한 번 더 눌러야 종료 (실수로 나가는 것 방지)

/** 두 번 눌러 종료로 인정하는 간격 */
const EXIT_WINDOW_MS = 2000;

/**
 * Radix 다이얼로그/시트/팝오버가 열려 있으면 ESC 를 보내 닫는다.
 * @returns 닫을 것이 있었으면 true
 */
function closeTopOverlay(): boolean {
  const selector =
    '[data-state="open"][role="dialog"],' +
    '[data-state="open"][role="alertdialog"],' +
    '[data-radix-popper-content-wrapper] [data-state="open"]';
  const open = document.querySelector(selector);
  if (!open) return false;

  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
  return true;
}

export function useAndroidBackButton() {
  const lastPressRef = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let remove: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      // @capacitor/app 이 없는 환경(웹 미리보기 등)에서도 앱이 죽지 않도록 방어
      let App: typeof import('@capacitor/app').App;
      try {
        ({ App } = await import('@capacitor/app'));
      } catch (e) {
        console.warn('[backButton] @capacitor/app 을 불러오지 못했습니다:', e);
        return;
      }
      if (cancelled) return;

      const handle = await App.addListener('backButton', () => {
        // 1) 떠 있는 다이얼로그 먼저 닫기
        if (closeTopOverlay()) return;

        // 2) 앱 안에서 뒤로 — react-router 가 history.state.idx 로 깊이를 남긴다
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
        if (idx > 0) {
          window.history.back();
          return;
        }

        // 3) 첫 화면 — 두 번 눌러야 종료
        const now = Date.now();
        if (now - lastPressRef.current < EXIT_WINDOW_MS) {
          App.exitApp();
          return;
        }
        lastPressRef.current = now;
        toast.message('한 번 더 누르면 앱이 닫혀요', { duration: EXIT_WINDOW_MS });
      });

      if (cancelled) {
        handle.remove();
        return;
      }
      remove = () => handle.remove();
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);
}
