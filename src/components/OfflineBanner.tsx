import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

// 화면 상단에 sticky 로 붙는 작은 배너.
// navigator.onLine === false 일 때만 표시되고, 'online'/'offline' 이벤트로 즉시 갱신.
export default function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-1.5 bg-amber-100 px-3 py-1.5 text-[11.5px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
    >
      <WifiOff className="h-3 w-3" />
      오프라인 모드 — 로컬 데이터만 사용 가능
    </div>
  );
}
