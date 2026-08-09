// ----------------------------------------------------------------------------
// 도안 PDF 보기
// ----------------------------------------------------------------------------
// 뜨면서 보는 화면이다. 한 손에는 바늘이 있다는 것을 전제로 만든다.
//   · 한 번에 한 장. 여러 장을 이어 놓으면 스크롤하다 자리를 잃는다.
//   · 확대는 크게. 도안 차트는 칸이 작아 기본 크기로는 안 보인다.
//   · 마지막으로 보던 장을 기억한다. 앱을 닫았다 열 때마다 1장부터면 못 쓴다.
//
// pdf.js 는 필요할 때만 불러온다 (동적 import). 도안을 한 번도 안 여는 사람이
// 1.5MB 를 같이 받을 이유가 없다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2 } from 'lucide-react';
import type { PatternFile } from '@/lib/db';

interface Props {
  file: PatternFile;
  /** 마지막으로 보던 장을 기억해 둘 열쇠 — 대개 도안 id */
  rememberKey?: string;
  onClose: () => void;
}

/** 확대 배율 — 손가락으로 누르기 좋게 띄엄띄엄 둔다 */
const ZOOM_STEPS = [1, 1.5, 2, 3, 4];

function pageMemoryKey(k?: string) {
  return k ? `pdfPage:${k}` : null;
}

export default function PdfViewer({ file, rememberKey, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // pdf.js 문서 객체. 타입을 가져오려면 pdf.js 를 위에서 import 해야 해서
  // (=묶음에 딸려 들어가서) 여기서는 any 로 둔다.
  const docRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 문서 열기 ──────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    let doc: any = null;

    (async () => {
      try {
        const { loadPdfjs, documentOptions } = await import('@/lib/pdfjs');
        const pdfjs = loadPdfjs();
        const data = await file.blob.arrayBuffer();
        if (!alive) return;

        doc = await pdfjs.getDocument(documentOptions(data)).promise;
        if (!alive) {
          doc.destroy();
          return;
        }

        docRef.current = doc;
        setPageCount(doc.numPages);

        // 보던 자리로 되돌린다. 도안이 바뀌었을 수 있으니 범위를 확인한다.
        const key = pageMemoryKey(rememberKey);
        const saved = key ? Number(localStorage.getItem(key)) : 0;
        setPage(saved >= 1 && saved <= doc.numPages ? saved : 1);
        setLoading(false);
      } catch (e) {
        console.error('[PdfViewer] 문서를 열지 못했습니다', e);
        if (alive) {
          setError('도안을 열지 못했어요. 파일이 손상되었을 수 있어요.');
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
      renderTaskRef.current?.cancel?.();
      doc?.destroy?.();
      docRef.current = null;
    };
  }, [file, rememberKey]);

  // ── 한 장 그리기 ───────────────────────────────────────────────────────
  const draw = useCallback(async () => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    // 앞의 그리기가 아직 돌고 있으면 멈춘다. 안 그러면 같은 캔버스에 두 장이
    // 겹쳐 그려져 화면이 뭉개진다.
    renderTaskRef.current?.cancel?.();
    setRendering(true);

    try {
      const p = await doc.getPage(page);
      const base = p.getViewport({ scale: 1 });

      // 화면 너비에 맞춘 뒤 확대 배율을 곱한다. 여기에 기기 화소비를 한 번 더
      // 곱해야 글자가 흐려지지 않는다 — 다만 너무 키우면 메모리를 다 먹으므로
      // 2배까지만 쓴다.
      const boxWidth = scrollRef.current?.clientWidth ?? window.innerWidth;
      const fit = Math.max(boxWidth - 16, 200) / base.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const zoom = ZOOM_STEPS[zoomIdx];
      const viewport = p.getViewport({ scale: fit * zoom * dpr });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      // 화면에 보이는 크기는 화소비를 뺀 값. 이래야 1배가 '화면 폭에 꽉' 이 된다.
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const task = p.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch (e) {
      // 다음 장으로 넘겨서 멈춘 것은 잘못이 아니다
      if ((e as { name?: string })?.name !== 'RenderingCancelledException') {
        console.error('[PdfViewer] 페이지를 그리지 못했습니다', e);
      }
    } finally {
      setRendering(false);
    }
  }, [page, zoomIdx]);

  useEffect(() => {
    if (!loading && !error) void draw();
  }, [draw, loading, error]);

  // 화면을 돌리면 폭이 달라진다. 다시 그려야 한다.
  useEffect(() => {
    const onResize = () => void draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  // 보던 자리 기억
  useEffect(() => {
    const key = pageMemoryKey(rememberKey);
    if (key && pageCount > 0) localStorage.setItem(key, String(page));
  }, [page, pageCount, rememberKey]);

  // 장을 넘기면 맨 위부터 보여준다 — 확대해 둔 채 넘기면 아래쪽이 나온다
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [page]);

  // ESC 로 닫기 + 뒤 화면 스크롤 잠금
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setPage(p => Math.max(1, p - 1));
      if (e.key === 'ArrowRight') setPage(p => Math.min(pageCount || 1, p + 1));
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, pageCount]);

  function download() {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || '도안.pdf';
    a.click();
    // 바로 지우면 저장이 시작되기 전에 주소가 사라지는 기기가 있다
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const body = (
    <div className="fixed inset-0 z-[60] flex flex-col bg-neutral-900">
      {/* 위 — 파일 이름과 닫기 */}
      <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-white">{file.name}</div>
        </div>
        <button
          type="button"
          onClick={download}
          aria-label="내려받기"
          className="rounded-full p-2 text-white/80 hover:bg-white/10"
        >
          <Download className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded-full p-2 text-white/80 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 가운데 — 도안 */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto overscroll-contain p-2">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-white/70">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">도안을 여는 중…</span>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center px-6">
            <p className="text-center text-sm leading-relaxed text-white/80">{error}</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <canvas ref={canvasRef} className="rounded bg-white shadow-lg" />
          </div>
        )}
      </div>

      {/* 아래 — 장 넘기기와 확대 */}
      {!loading && !error && (
        <div className="flex shrink-0 items-center gap-1 border-t border-white/10 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="이전 장"
            className="rounded-full p-2 text-white/80 disabled:opacity-30"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <div className="flex flex-1 items-center justify-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={pageCount}
              value={page}
              onChange={e => {
                const n = Number(e.target.value);
                if (n >= 1 && n <= pageCount) setPage(n);
              }}
              aria-label="장 번호"
              className="w-12 rounded-lg border border-white/20 bg-white/10 px-1 py-1 text-center text-[13px] tabular-nums text-white outline-none focus:border-white/50"
            />
            <span className="text-[13px] tabular-nums text-white/60">/ {pageCount}</span>
            {rendering && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />}
          </div>

          <button
            type="button"
            onClick={() => setZoomIdx(i => Math.max(0, i - 1))}
            disabled={zoomIdx <= 0}
            aria-label="축소"
            className="rounded-full p-2 text-white/80 disabled:opacity-30"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="w-8 text-center text-[11px] tabular-nums text-white/60">
            {ZOOM_STEPS[zoomIdx]}x
          </span>
          <button
            type="button"
            onClick={() => setZoomIdx(i => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIdx >= ZOOM_STEPS.length - 1}
            aria-label="확대"
            className="rounded-full p-2 text-white/80 disabled:opacity-30"
          >
            <ZoomIn className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setPage(p => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
            aria-label="다음 장"
            className="rounded-full p-2 text-white/80 disabled:opacity-30"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(body, document.body) : body;
}
