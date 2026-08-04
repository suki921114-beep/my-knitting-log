import { setupGlobalErrorLogging } from "@/lib/errorLog";
import { startTrashAutoPurge } from "@/lib/autoPurge";

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

setupGlobalErrorLogging();

// 휴지통 자동 영구삭제 (삭제 후 7일 경과 항목)
startTrashAutoPurge();

createRoot(document.getElementById("root")!).render(<App />);

// PWA — production 빌드에서만 Service Worker 등록 (dev 의 HMR 충돌 방지)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] SW 등록 실패:', err);
    });
  });
}
