// ----------------------------------------------------------------------------
// 도안 미리보기를 그림으로
// ----------------------------------------------------------------------------
// 차트 도안은 단수를 세는 대신 무늬를 보고 뜬다. 그럴 때 필요한 것은 숫자가
// 아니라 도안 그 자체라, 홈 화면에 도안 한 쪽을 띄워 두면 폰을 켜지 않고도
// 뜰 수 있다.
//
// 위젯은 PDF 를 못 읽는다. 그래서 앱이 pdf.js 로 한 쪽을 그림으로 그려 넘긴다.
// 형광펜 자국도 같이 얹는다 — 어디까지 떴는지가 안 보이면 띄워 둘 이유가 없다.
//
// ⚠️ 무겁다. 미리보기 위젯이 실제로 붙어 있는 프로젝트만 그린다.
//    진행중인 것을 전부 그리면 앱을 나갈 때마다 몇 초씩 걸린다.

import { db } from '@/lib/db';
import { marksFor, markOpacity } from '@/lib/patternMark';

/**
 * 그림 한 변의 최대 크기.
 *
 * 위젯에 그림을 넘기는 통로(RemoteViews)는 크기 제한이 빡빡하다. 크게 넘기면
 * 위젯이 통째로 안 뜬다. 차트 칸이 보일 만큼은 되면서 통로를 넘지 않는 선.
 */
const PREVIEW_MAX_DIM = 720;
const PREVIEW_QUALITY = 0.72;

/** PdfViewer 가 '보던 쪽' 을 적어 두는 자리와 같은 규칙 */
function rememberedPage(patternId: number, fileCloudId: string | undefined, index: number): number {
  try {
    const key = `pdfPage:${patternId}:${fileCloudId ?? index}`;
    const saved = Number(localStorage.getItem(key));
    return saved >= 1 ? saved : 1;
  } catch {
    return 1;
  }
}

/**
 * 프로젝트별로 '마지막에 보던 도안 파일'.
 *
 * 도안이 여러 개면 그중 몇 번째를 보고 있었는지 알아야 한다. 안 그러면 위젯이
 * 늘 첫 번째 파일만 띄워서, 차트 도안을 보다가 홈에 나가면 엉뚱한 설명 쪽이
 * 떠 있게 된다.
 */
const LAST_FILE_KEY = (projectId: number) => `widgetFile:${projectId}`;

export function rememberViewedFile(projectId: number, patternFileId: number): void {
  try {
    localStorage.setItem(LAST_FILE_KEY(projectId), String(patternFileId));
  } catch {
    // 기억 못 하면 첫 번째 파일로 떨어진다. 그만한 일이다.
  }
}

function lastViewedFileId(projectId: number): number | null {
  try {
    const raw = Number(localStorage.getItem(LAST_FILE_KEY(projectId)));
    return raw > 0 ? raw : null;
  } catch {
    return null;
  }
}

/**
 * 이 프로젝트에서 보던 도안 한 쪽을 그림으로. 없으면 빈 문자열.
 *
 * 실패해도 throw 하지 않는다. 미리보기가 없는 위젯은 심심할 뿐이지만,
 * 여기서 터지면 위젯 갱신 전체가 멈춘다.
 */
export async function renderPatternPreview(projectId: number): Promise<string> {
  try {
    // 마지막에 보던 파일이 있으면 그것부터. 없으면 연결된 도안의 첫 파일.
    const wanted = lastViewedFileId(projectId);
    if (wanted != null) {
      const file = await db.patternFiles.get(wanted);
      if (file) {
        const page = rememberedPage(file.patternId, file.cloudId, 0);
        const drawn = await drawPage(file.blob, page, file.id);
        if (drawn) return drawn;
      }
    }

    const links = await db.projectPatterns.where('projectId').equals(projectId).toArray();
    if (!links.length) return '';

    // 연결된 도안 중 PDF 가 있는 첫 번째
    for (const link of links) {
      const files = await db.patternFiles
        .where('patternId')
        .equals(link.patternId)
        .toArray();
      if (!files.length) continue;

      files.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const file = files[0];
      const page = rememberedPage(link.patternId, file.cloudId, 0);
      const drawn = await drawPage(file.blob, page, file.id);
      if (drawn) return drawn;
    }
    return '';
  } catch (e) {
    console.warn('[widget] 도안 미리보기 실패 (무시)', e);
    return '';
  }
}

async function drawPage(blob: Blob, page: number, fileId?: number): Promise<string> {
  const { loadPdfjs, documentOptions } = await import('@/lib/pdfjs');
  const pdfjs = loadPdfjs();

  const data = await blob.arrayBuffer();
  const doc = await pdfjs.getDocument(documentOptions(data)).promise;
  try {
    const safePage = Math.min(Math.max(1, page), doc.numPages);
    const pdfPage = await doc.getPage(safePage);

    const base = pdfPage.getViewport({ scale: 1 });
    const scale = Math.min(2, PREVIEW_MAX_DIM / Math.max(base.width, base.height));
    const viewport = pdfPage.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // PDF 는 배경이 비어 있다. 흰색을 깔지 않으면 JPEG 에서 검게 나온다.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await pdfPage.render({ canvasContext: ctx, viewport }).promise;

    if (fileId != null) await paintMarks(ctx, canvas, fileId, safePage);

    const out = canvas.toDataURL('image/jpeg', PREVIEW_QUALITY);
    const comma = out.indexOf(',');
    return comma < 0 ? '' : out.slice(comma + 1);
  } finally {
    doc.destroy();
  }
}

/**
 * 형광펜 자국을 얹는다.
 *
 * 자국은 도안 좌표(0~1)로 저장돼 있어 지금 그린 크기를 곱하면 된다.
 * 화면에서는 CSS 로 섞지만 여기서는 캔버스 하나에 바로 그리므로
 * globalCompositeOperation 으로 섞는다 — 같은 캔버스 안이라 이건 먹는다.
 */
async function paintMarks(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  fileId: number,
  page: number,
): Promise<void> {
  const marks = await marksFor(fileId, page);
  if (!marks.length) return;

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const m of marks) {
    if (m.points.length < 2) continue;
    ctx.globalAlpha = markOpacity(m);
    ctx.strokeStyle = m.color;
    ctx.lineWidth = Math.max(1, m.width * canvas.width);
    ctx.beginPath();
    ctx.moveTo(m.points[0] * canvas.width, m.points[1] * canvas.height);
    for (let i = 2; i + 1 < m.points.length; i += 2) {
      ctx.lineTo(m.points[i] * canvas.width, m.points[i + 1] * canvas.height);
    }
    ctx.stroke();
  }

  ctx.restore();
}
