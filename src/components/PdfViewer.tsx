// ----------------------------------------------------------------------------
// 도안 PDF 보기
// ----------------------------------------------------------------------------
// 뜨면서 보는 화면이다. 한 손에는 바늘이 있다는 것을 전제로 만든다.
//   · 한 번에 한 장. 여러 장을 이어 놓으면 스크롤하다 자리를 잃는다.
//   · 확대는 크게. 도안 차트는 칸이 작아 기본 크기로는 안 보인다.
//   · 마지막으로 보던 장을 기억한다. 앱을 닫았다 열 때마다 1장부터면 못 쓴다.
//
// 두 가지 모양으로 쓴다.
//   PdfSurface — 주어진 자리를 채운다. 화면을 반으로 갈라 쓰는 뜨기 모드용.
//   PdfViewer  — 화면 전체를 덮는다. 도안만 볼 때.
//
// pdf.js 는 필요할 때만 불러온다 (동적 import). 도안을 한 번도 안 여는 사람이
// 1.5MB 를 같이 받을 이유가 없다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2,
  Highlighter, Undo2, Eraser,
} from 'lucide-react';
import { db, type PatternFile } from '@/lib/db';
import {
  MARK_COLORS, MARK_WIDTH, MARK_OPACITY, MIN_MARK_WIDTH, MAX_MARK_WIDTH,
  MIN_MARK_OPACITY, MAX_MARK_OPACITY, markOpacity,
  addMark, undoLastMark, clearMarks, marksFor, markAt, shouldAddPoint,
} from '@/lib/patternMark';

// ── 확대 ──────────────────────────────────────────────────────────────────
// 확대는 '어디를' 이 중요하다. 도안에서 보고 싶은 건 지금 뜨는 부분이지
// 페이지 한가운데가 아니다. 그래서 배율을 바꿀 때 기준점을 잡아 두고,
// 다시 그린 뒤 그 점이 같은 자리에 오도록 스크롤을 옮긴다.
//
// 기준점은 셋 중 하나다.
//   버튼   — 지금 보고 있는 화면의 한가운데
//   두 번 톡 — 톡 한 자리
//   손가락 벌리기 — 두 손가락 사이

/** 버튼으로 오갈 배율 */
const ZOOM_PRESETS = [1, 1.5, 2, 3, 4, 6];
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
/** 두 번 톡 했을 때 커지는 배율 */
const DOUBLE_TAP_ZOOM = 2.5;

const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/**
 * 다시 그린 뒤 되찾을 기준점.
 *   fx, fy — 도안 안에서의 자리 (0~1). 배율이 바뀌어도 그대로다.
 *   ax, ay — 화면(보이는 칸) 안에서의 자리. 이 점이 안 움직여야 한다.
 */
interface ZoomAnchor {
  fx: number;
  fy: number;
  ax: number;
  ay: number;
}

function pageMemoryKey(k?: string) {
  return k ? `pdfPage:${k}` : null;
}

/** 파일을 기기에 내려받는다 */
export function downloadPatternFile(file: { name: string; blob: Blob }) {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name || '도안.pdf';
  a.click();
  // 바로 지우면 저장이 시작되기 전에 주소가 사라지는 기기가 있다
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

interface SurfaceProps {
  file: PatternFile;
  /** 마지막으로 보던 장을 기억해 둘 열쇠 — 대개 도안 id */
  rememberKey?: string;
  className?: string;
  /**
   * 형광펜을 쓸 수 있는지. 저장된 파일에만 켠다 —
   * 아직 저장 안 한 파일에 그으면 자국을 어디에 붙일지 알 수 없다.
   */
  allowMarks?: boolean;
}

/**
 * 도안을 그리는 부분. 부모가 준 자리를 그대로 채운다.
 *
 * ⚠️ 부모는 반드시 높이가 정해져 있어야 한다 (h-full 이나 flex-1).
 *    높이가 내용에 따라 늘어나는 자리에 두면 캔버스와 부모가 서로를 밀며
 *    끝없이 커진다.
 */
export function PdfSurface({ file, rememberKey, className = '', allowMarks = true }: SurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // pdf.js 문서 객체. 타입을 가져오려면 pdf.js 를 위에서 import 해야 해서
  // (=묶음에 딸려 들어가서) 여기서는 any 로 둔다.
  const docRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  /** 손가락을 벌리는 동안만 쓰는 미리보기 배율 (실제로 다시 그리지는 않는다) */
  const [liveScale, setLiveScale] = useState(1);
  const anchorRef = useRef<ZoomAnchor | null>(null);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 형광펜 ─────────────────────────────────────────────────────────────
  const fileId = allowMarks ? file.id ?? null : null;
  const [penOn, setPenOn] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [color, setColor] = useState<string>(MARK_COLORS[0].css);
  const [opacity, setOpacity] = useState(MARK_OPACITY);
  const [penWidth, setPenWidth] = useState(MARK_WIDTH);
  /** 색을 한 번 더 누르면 진하기·굵기를 여는 자리 */
  const [tuning, setTuning] = useState(false);
  /** 지금 손가락이 긋고 있는 선 — 다 긋고 손을 떼면 저장한다 */
  const drawingRef = useRef<number[] | null>(null);

  const marks = useLiveQuery(
    () => (fileId == null ? Promise.resolve([]) : marksFor(fileId, page)),
    [fileId, page],
  ) || [];

  // ── 문서 열기 ──────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    let doc: any = null;

    setLoading(true);
    setError(null);

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
          // 원인을 나눠서 알린다. '손상' 이라고만 하면 고칠 방법이 없어 보인다.
          // 실제로 가장 흔한 건 원본 파일이 사라진 경우이고, 그건 다시 넣으면 된다.
          const name = (e as { name?: string })?.name ?? '';
          setError(
            name === 'NotReadableError' || name === 'NotFoundError'
              ? '도안 파일을 읽지 못했어요. 원본이 옮겨졌거나 지워졌을 수 있어요. 도안 수정 화면에서 PDF를 다시 넣어주세요.'
              : '도안을 열지 못했어요. PDF가 아니거나 파일이 손상되었을 수 있어요.',
          );
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

  /**
   * 지금 화면의 어느 점을 붙잡을지 정해 둔다.
   * clientX/Y 를 안 주면 보이는 칸의 한가운데를 잡는다.
   *
   * ⚠️ 손가락으로 벌리는 중(liveScale ≠ 1)에는 부르면 안 된다. 화면에 보이는
   *    크기가 실제로 그려진 크기와 달라서 자리가 어긋난다. 벌리기 시작할 때
   *    미리 잡아 둔다.
   */
  const captureAnchor = useCallback((clientX?: number, clientY?: number) => {
    const box = scrollRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;

    const boxRect = box.getBoundingClientRect();
    const cRect = canvas.getBoundingClientRect();
    const px = clientX ?? boxRect.left + boxRect.width / 2;
    const py = clientY ?? boxRect.top + boxRect.height / 2;

    // 도안 밖을 잡으면(좌우 여백) 가장자리로 당겨 둔다
    const unit = (v: number, min: number, size: number) =>
      size > 0 ? Math.max(0, Math.min(1, (v - min) / size)) : 0.5;

    anchorRef.current = {
      fx: unit(px, cRect.left, cRect.width),
      fy: unit(py, cRect.top, cRect.height),
      ax: px - boxRect.left,
      ay: py - boxRect.top,
    };
  }, []);

  /** 새로 그린 크기에 맞춰 붙잡아 둔 점을 제자리로 되돌린다 */
  const restoreAnchor = useCallback(() => {
    const a = anchorRef.current;
    const box = scrollRef.current;
    const canvas = canvasRef.current;
    if (!a || !box || !canvas) return;
    anchorRef.current = null;

    const boxRect = box.getBoundingClientRect();
    const cRect = canvas.getBoundingClientRect();
    // 그 점이 지금 화면 어디에 있고, 어디에 있어야 하는가
    box.scrollLeft += cRect.left + a.fx * cRect.width - (boxRect.left + a.ax);
    box.scrollTop += cRect.top + a.fy * cRect.height - (boxRect.top + a.ay);
  }, []);

  /**
   * 기준점을 잡고 배율을 바꾼다.
   *
   * ⚠️ 기준점 잡기를 setZoom 안에서 하면 안 된다. 화면을 그리는 중에 끼어드는
   *    일이 되어, React 가 갱신 함수를 두 번 부르는 경우 두 번 잡힌다.
   */
  const zoomTo = useCallback(
    (next: number, clientX?: number, clientY?: number) => {
      const target = clampZoom(next);
      if (Math.abs(zoom - target) < 0.001) return;
      captureAnchor(clientX, clientY);
      setZoom(target);
    },
    [zoom, captureAnchor],
  );

  /**
   * 형광펜 자국을 덧그린다.
   *
   * 도안 좌표(0~1)에 지금 캔버스 크기를 곱한다. 그래서 몇 배로 키우든
   * 밑줄이 같은 글자 위에 남는다.
   *
   * multiply 로 겹쳐야 아래 글자가 비친다. 그냥 덮으면 형광펜이 아니라
   * 물감이 되어 글자가 안 보인다.
   */
  const paintMarks = useCallback((live?: number[] | null) => {
    const base = canvasRef.current;
    const layer = markRef.current;
    if (!base || !layer) return;

    layer.width = base.width;
    layer.height = base.height;
    layer.style.width = base.style.width;
    layer.style.height = base.style.height;

    const ctx = layer.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, layer.width, layer.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // ⚠️ 여기서 multiply 를 걸어도 소용없다. 캔버스 안에서만 섞이고 아래에 깔린
    //    도안까지는 닿지 않는다. 겹치는 일은 CSS(mix-blend-mode)가 맡는다.
    //    진하기는 여기서 획마다 따로 준다 — 자국마다 값이 다를 수 있다.
    const stroke = (points: number[], css: string, w: number, alpha: number) => {
      if (points.length < 2) return;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = css;
      ctx.lineWidth = Math.max(2, w * layer.width);
      ctx.beginPath();
      ctx.moveTo(points[0] * layer.width, points[1] * layer.height);
      for (let i = 2; i + 1 < points.length; i += 2) {
        ctx.lineTo(points[i] * layer.width, points[i + 1] * layer.height);
      }
      // 점 하나만 찍었으면 선이 안 그려진다 — 제자리에 한 번 더 이어 점으로 만든다
      if (points.length === 2) ctx.lineTo(points[0] * layer.width + 0.1, points[1] * layer.height);
      ctx.stroke();
    };

    for (const m of marks) stroke(m.points, m.color, m.width, markOpacity(m));
    if (live) stroke(live, color, penWidth, opacity);
    ctx.globalAlpha = 1;
  }, [marks, color, opacity, penWidth]);

  // 자국이 바뀌거나 장을 넘기면 다시 덧그린다
  useEffect(() => { paintMarks(); }, [paintMarks, page, zoom]);

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

      // 자리 너비에 맞춘 뒤 확대 배율을 곱한다. 여기에 기기 화소비를 한 번 더
      // 곱해야 글자가 흐려지지 않는다 — 다만 너무 키우면 메모리를 다 먹으므로
      // 2배까지만 쓴다.
      const boxWidth = scrollRef.current?.clientWidth ?? window.innerWidth;
      const fit = Math.max(boxWidth - 16, 200) / base.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = p.getViewport({ scale: fit * zoom * dpr });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      // 화면에 보이는 크기는 화소비를 뺀 값. 이래야 1배가 '자리 폭에 꽉' 이 된다.
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

      // 크기가 정해진 바로 이때 스크롤을 옮긴다. 그림이 다 그려질 때까지
      // 기다리면 잠깐 엉뚱한 자리가 보였다가 튄다.
      restoreAnchor();

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const task = p.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
      // 도안이 새 크기로 그려졌으니 자국도 그 크기에 맞춰 다시
      paintMarks(drawingRef.current);
    } catch (e) {
      // 다음 장으로 넘겨서 멈춘 것은 잘못이 아니다
      if ((e as { name?: string })?.name !== 'RenderingCancelledException') {
        console.error('[PdfViewer] 페이지를 그리지 못했습니다', e);
      }
    } finally {
      setRendering(false);
    }
  }, [page, zoom, restoreAnchor, paintMarks]);

  useEffect(() => {
    if (!loading && !error) void draw();
  }, [draw, loading, error]);

  // 자리 크기가 달라지면 다시 그린다.
  // 화면을 돌릴 때뿐 아니라, 뜨기 모드에서 칸막이를 끌어 나눌 때도 바뀐다 —
  // window resize 만 보면 칸막이를 옮겨도 도안 크기가 그대로다.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      const onResize = () => void draw();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    // 끄는 동안 매 픽셀마다 다시 그리면 버벅인다. 손을 멈춘 뒤에 한 번만 그린다.
    let timer: ReturnType<typeof setTimeout>;
    let lastWidth = el.clientWidth;
    const ob = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return;
      lastWidth = el.clientWidth;
      clearTimeout(timer);
      timer = setTimeout(() => void draw(), 150);
    });
    ob.observe(el);
    return () => {
      clearTimeout(timer);
      ob.disconnect();
    };
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

  // ── 손가락 ─────────────────────────────────────────────────────────────
  // 벌리기(확대)와 두 번 톡(확대/되돌리기)을 직접 받는다.
  // 한 손가락으로 끄는 것은 건드리지 않는다 — 브라우저가 알아서 스크롤한다.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  function pointerPair() {
    const [a, b] = [...pointers.current.values()];
    return a && b ? { a, b } : null;
  }
  function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** 화면의 한 점을 도안 좌표(0~1)로 바꾼다 */
  function toPaper(clientX: number, clientY: number): { x: number; y: number } | null {
    const c = canvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height };
  }

  function onPointerDown(e: React.PointerEvent) {
    // 그리는 중에는 확대·스크롤을 잡지 않는다. 손가락 하나가 두 일을 할 수 없다.
    if (penOn && fileId != null && pointers.current.size === 0) {
      const p = toPaper(e.clientX, e.clientY);
      if (!p) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      if (erasing) {
        const hit = markAt(marks, p.x, p.y, 0.03);
        if (hit?.id != null) void db.patternMarks.delete(hit.id);
        return;
      }
      drawingRef.current = [p.x, p.y];
      paintMarks(drawingRef.current);
      return;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pair = pointerPair();
    if (pair && !pinch.current) {
      // 벌리기 시작. 기준점은 지금 두 손가락 사이 —
      // 미리보기(liveScale)가 걸리기 전인 지금 잡아야 자리가 안 어긋난다.
      captureAnchor((pair.a.x + pair.b.x) / 2, (pair.a.y + pair.b.y) / 2);
      pinch.current = { dist: distance(pair.a, pair.b), zoom };
      lastTap.current = null;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (drawingRef.current) {
      const p = toPaper(e.clientX, e.clientY);
      if (p && shouldAddPoint(drawingRef.current, p.x, p.y)) {
        drawingRef.current.push(p.x, p.y);
        paintMarks(drawingRef.current);
      }
      return;
    }
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pair = pointerPair();
    if (!pair || !pinch.current) return;
    // 벌린 만큼 미리 키워 보여만 준다. 매 순간 다시 그리면 버벅인다.
    const k = distance(pair.a, pair.b) / (pinch.current.dist || 1);
    setLiveScale(clampZoom(pinch.current.zoom * k) / pinch.current.zoom);
  }

  function endPinch() {
    const start = pinch.current;
    pinch.current = null;
    if (!start) return;
    // 손을 뗀 배율로 실제로 다시 그린다. 기준점은 시작할 때 잡아 둔 것.
    const next = clampZoom(start.zoom * liveScale);
    setLiveScale(1);
    if (Math.abs(zoom - next) < 0.001) {
      // 배율이 그대로면 다시 그릴 일이 없다 — 잡아 둔 기준점도 버린다
      anchorRef.current = null;
      return;
    }
    setZoom(next);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (drawingRef.current) {
      const points = drawingRef.current;
      drawingRef.current = null;
      // 점 하나뿐이면 톡 친 것이다. 자국으로 남길 만하지 않다.
      if (points.length >= 4 && fileId != null) {
        void addMark({ patternFileId: fileId, page, points, color, width: penWidth, opacity });
      } else {
        paintMarks();
      }
      return;
    }
    const p = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);

    if (pinch.current) {
      if (pointers.current.size < 2) endPinch();
      return;
    }
    if (!p) return;

    // 두 번 톡 — 손가락 하나로, 짧은 사이에, 거의 같은 자리를
    const now = Date.now();
    const prev = lastTap.current;
    const near = prev && Math.hypot(prev.x - e.clientX, prev.y - e.clientY) < 30;
    if (prev && near && now - prev.t < 300) {
      lastTap.current = null;
      zoomTo(zoom > 1.01 ? 1 : DOUBLE_TAP_ZOOM, e.clientX, e.clientY);
    } else {
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  }

  function onPointerCancel(e: React.PointerEvent) {
    if (drawingRef.current) { drawingRef.current = null; paintMarks(); }
    pointers.current.delete(e.pointerId);
    if (pinch.current && pointers.current.size < 2) endPinch();
  }

  /** 버튼용 — 다음/이전 눈금으로 */
  function stepZoom(dir: 1 | -1) {
    const next =
      dir > 0
        ? ZOOM_PRESETS.find(z => z > zoom + 0.01) ?? MAX_ZOOM
        : [...ZOOM_PRESETS].reverse().find(z => z < zoom - 0.01) ?? MIN_ZOOM;
    zoomTo(next);
  }

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {/* 도안.
          touchAction 을 pan 으로 묶어 두면 브라우저가 두 손가락 벌리기를
          '앱 전체 확대' 로 가져가지 않는다. 한 손가락 끌기(스크롤)는 그대로다. */}
      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        // 그리는 동안에는 스크롤이 끼어들면 안 된다. 선이 끊기고 화면이 튄다.
        style={{ touchAction: penOn ? 'none' : 'pan-x pan-y' }}
        // ⚠️ 가운데 정렬에 justify-center 를 쓰면 안 된다.
        //    내용이 화면보다 커졌을 때 왼쪽(위쪽)으로 넘친 부분이 스크롤로
        //    닿지 않는다 — 4배로 키우면 왼쪽 절반이 갈 수 없는 자리가 된다.
        //    flex 컨테이너에 자식 margin:auto 를 쓰면 남을 땐 가운데로 오고
        //    넘칠 땐 양쪽 다 스크롤된다.
        className="flex min-h-0 flex-1 overflow-auto overscroll-contain p-2"
      >
        {loading ? (
          <div className="m-auto flex items-center gap-2 text-white/70">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">도안을 여는 중…</span>
          </div>
        ) : error ? (
          <p className="m-auto max-w-xs text-center text-sm leading-relaxed text-white/80">
            {error}
          </p>
        ) : (
          <div
            className="relative m-auto"
            style={liveScale === 1 ? undefined : { transform: `scale(${liveScale})` }}
          >
            <canvas ref={canvasRef} className="block rounded bg-white shadow-lg" />
            {/* 형광펜 자국은 도안 위에 따로 얹는다. 도안을 다시 그릴 때마다
                자국까지 다시 그리지 않아도 되고, 지울 때도 도안이 안 상한다.
                손가락은 아래 도안이 받으므로 여기서는 안 받는다. */}
            <canvas
              ref={markRef}
              // 아래 도안과 섞이게 하는 건 CSS 다. 이걸 빼면 형광펜이 아니라
              // 물감이 되어 표시한 글자가 안 보인다.
              style={{ mixBlendMode: 'multiply' }}
              className="pointer-events-none absolute left-0 top-0"
            />
          </div>
        )}
      </div>

      {/*
        형광펜 줄.

        색은 형광펜을 켜지 않아도 늘 보인다. 켜야만 보이면 이 기능이 있다는 것
        자체를 모른다 — 실제로 못 찾겠다는 말을 들었다. 색을 누르는 것이 곧
        형광펜을 켜는 일이 된다.
      */}
      {!loading && !error && fileId != null && (
        <div className="relative shrink-0 border-t border-white/10 px-3 py-2">
          {/* 진하기·굵기 — 쓰던 색을 한 번 더 누르면 열린다 */}
          {tuning && (
            <div className="absolute bottom-full left-3 right-3 z-10 mb-2 rounded-2xl border border-white/10 bg-neutral-900 p-3 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-white/90">형광펜 굵기와 진하기</span>
                <button
                  type="button"
                  onClick={() => setTuning(false)}
                  className="rounded-full px-2 py-1 text-[12px] text-white/60 hover:bg-white/10"
                >
                  닫기
                </button>
              </div>

              {/* 고른 값이 어떻게 보일지 — 숫자보다 이게 빠르다 */}
              <div className="mb-3 flex h-10 items-center rounded-lg bg-white px-3">
                <span className="text-[13px] text-neutral-800">보기</span>
                <span
                  className="ml-2 flex-1 rounded-sm"
                  style={{
                    background: color,
                    opacity,
                    height: `${Math.round(penWidth * 260)}px`,
                  }}
                />
              </div>

              <label className="mb-2 block">
                <span className="mb-1 flex justify-between text-[12px] text-white/60">
                  <span>진하기</span>
                  <span>{Math.round(opacity * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={MIN_MARK_OPACITY}
                  max={MAX_MARK_OPACITY}
                  step={0.05}
                  value={opacity}
                  onChange={e => setOpacity(Number(e.target.value))}
                  className="w-full accent-pink-400"
                />
              </label>

              <label className="block">
                <span className="mb-1 flex justify-between text-[12px] text-white/60">
                  <span>굵기</span>
                  <span>{Math.round((penWidth / MARK_WIDTH) * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={MIN_MARK_WIDTH}
                  max={MAX_MARK_WIDTH}
                  step={0.002}
                  value={penWidth}
                  onChange={e => setPenWidth(Number(e.target.value))}
                  className="w-full accent-pink-400"
                />
              </label>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setPenOn(v => !v); setErasing(false); setTuning(false); }}
              aria-label="형광펜"
              aria-pressed={penOn}
              className={`shrink-0 rounded-full p-2 transition ${
                penOn ? 'bg-white text-neutral-900' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Highlighter className="h-5 w-5" />
            </button>

            {MARK_COLORS.map(c => {
              const picked = color === c.css && penOn && !erasing;
              return (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => {
                    // 쓰던 색을 한 번 더 누르면 진하기·굵기를 연다
                    if (picked) { setTuning(v => !v); return; }
                    setColor(c.css);
                    setPenOn(true);
                    setErasing(false);
                    setTuning(false);
                  }}
                  aria-label={picked ? `${c.label} — 굵기와 진하기` : c.label}
                  className={`h-8 w-8 shrink-0 rounded-full border-2 transition ${
                    picked ? 'border-white' : 'border-transparent opacity-70'
                  }`}
                  style={{ background: c.css }}
                />
              );
            })}

            {penOn && (
              <>
                <span className="mx-0.5 h-6 w-px bg-white/15" />
                <button
                  type="button"
                  onClick={() => { setErasing(v => !v); setTuning(false); }}
                  aria-label="지우개"
                  className={`rounded-full p-2 transition ${
                    erasing ? 'bg-white text-neutral-900' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <Eraser className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void undoLastMark(fileId, page)}
                  aria-label="되돌리기"
                  className="rounded-full p-2 text-white/80 hover:bg-white/10"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void clearMarks(fileId, page)}
                  className="ml-auto shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-white/70 hover:bg-white/10"
                >
                  이 쪽 지우기
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 장 넘기기와 확대 */}
      {!loading && !error && (
        <div className="flex shrink-0 items-center gap-1 border-t border-white/10 px-2 py-1.5">
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
            onClick={() => stepZoom(-1)}
            disabled={zoom <= MIN_ZOOM + 0.01}
            aria-label="축소"
            className="rounded-full p-2 text-white/80 disabled:opacity-30"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          {/* 눌러서 원래 크기로 — 많이 키워 놓고 되돌릴 때 버튼을 여러 번 안 눌러도 된다 */}
          <button
            type="button"
            onClick={() => zoomTo(1)}
            aria-label="원래 크기로"
            className="w-9 text-center text-[11px] tabular-nums text-white/60"
          >
            {zoom % 1 === 0 ? zoom : zoom.toFixed(1)}x
          </button>
          <button
            type="button"
            onClick={() => stepZoom(1)}
            disabled={zoom >= MAX_ZOOM - 0.01}
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
}

interface Props {
  /** 이 도안에 딸린 파일들 — 차트 따로, 사이즈 옵션 따로일 수 있다 */
  files: PatternFile[];
  index: number;
  onIndexChange: (i: number) => void;
  rememberKey?: string;
  onClose: () => void;
}

/**
 * 화면 전체를 덮는 뷰어.
 *
 * 파일이 여럿이면 위에 이름 탭이 생긴다. 도안을 보다가 차트로 건너뛰는 일이
 * 잦아서, 나갔다 다시 들어오게 하지 않는다.
 */
export default function PdfViewer({ files, index, onIndexChange, rememberKey, onClose }: Props) {
  const file = files[index];

  // ESC 로 닫기 + 뒤 화면 스크롤 잠금
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!file) return null;

  const body = (
    <div className="fixed inset-0 z-[60] flex flex-col bg-neutral-900">
      <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-white">{file.name}</div>
        </div>
        <button
          type="button"
          onClick={() => downloadPatternFile(file)}
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

      {/* 파일이 여럿일 때만 고르는 줄을 낸다 */}
      {files.length > 1 && (
        <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-3 pb-2">
          {files.map((f, i) => (
            <button
              type="button"
              key={f.cloudId ?? f.id ?? i}
              onClick={() => onIndexChange(i)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                i === index ? 'bg-white text-neutral-900' : 'bg-white/10 text-white/70'
              }`}
            >
              <span className="max-w-[9rem] truncate">{f.name.replace(/\.pdf$/i, '')}</span>
            </button>
          ))}
        </div>
      )}

      <PdfSurface
        file={file}
        // 파일마다 보던 장을 따로 기억한다 — 본문 3장과 차트 1장은 다른 자리다
        rememberKey={rememberKey ? `${rememberKey}:${file.cloudId ?? index}` : undefined}
        className="flex-1 pb-[env(safe-area-inset-bottom,0px)]"
      />
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(body, document.body) : body;
}
