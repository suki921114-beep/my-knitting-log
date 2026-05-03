// ----------------------------------------------------------------------------
// 이미지 압축 — IndexedDB 안전 저장용 dataURL 생성
// ----------------------------------------------------------------------------
// 모바일에서 찍은 큰 이미지(JPEG 8~12MB, HEIC 가 JPEG 으로 변환된 큰 파일 포함)
// 를 그대로 IndexedDB 에 넣으면:
//   - 단일 항목 quota 위반으로 저장 실패
//   - 동기화 페이로드(dexie 트랜잭션 + Firestore upload) 비대화
//   - 메모리 폭주(canvas 변환 시 OOM)
// 를 일으킬 수 있다. 그래서 모든 이미지 입력은 이 함수를 통과한다.
//
// 안정성 보장 포인트:
//   1) EXIF 회전 정보 자동 보정 (createImageBitmap + imageOrientation:'from-image')
//      → iPhone 인물 사진이 옆으로 누워 저장되는 문제 방지
//   2) 1차 압축 후 결과가 maxBytes 를 넘으면 더 낮은 품질/치수로 재시도(progressive)
//      → 매우 큰 원본도 저장 가능한 크기까지 줄어든다
//   3) drawImage 가 실패해도 원본 dataUrl 을 fallback 으로 반환
//   4) 모든 단계에 try/catch 가 들어가 있어 호출처에서 toast 처리 가능

export type CompressOptions = {
  /** 가로/세로 중 긴 쪽 픽셀 상한. 기본 1280. */
  maxDim?: number;
  /** JPEG quality (0~1). 기본 0.8. */
  quality?: number;
  /**
   * 결과 dataURL 의 최대 byte 크기. 초과 시 quality/maxDim 을 단계적으로
   * 낮춰 재시도. 기본 1.5MB.
   */
  maxBytes?: number;
};

const DEFAULTS: Required<Omit<CompressOptions, 'maxBytes'>> & { maxBytes: number } = {
  maxDim: 1280,
  quality: 0.8,
  maxBytes: 1.5 * 1024 * 1024,
};

export async function fileToCompressedDataUrl(
  file: File,
  opts: CompressOptions = {},
): Promise<string> {
  const { maxDim, quality, maxBytes } = { ...DEFAULTS, ...opts };
  const isPng = file.type === 'image/png';

  // 원본 dataUrl 은 fallback 용으로만 보관 (압축 경로 실패 시)
  let originalDataUrl: string | undefined;
  try {
    originalDataUrl = await readAsDataURL(file);
  } catch {
    // 매우 드문 경우 — readAsDataURL 자체 실패. 빈 문자열 반환.
    return '';
  }

  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await loadOriented(file, originalDataUrl);
  } catch {
    // 디코드 실패(HEIC 등) — 원본 dataUrl 을 그대로 반환. 호출처에서 화면에
    // 안 뜨면 사용자가 인지 가능.
    return originalDataUrl;
  }

  // 1차 시도
  let result = drawAndEncode(bitmap, maxDim, quality, isPng);
  if (result === null) {
    return originalDataUrl;
  }

  // PNG 는 quality 무시되므로 progressive 가 무의미 → 그대로 반환
  if (isPng) {
    closeBitmapIfNeeded(bitmap);
    return result;
  }

  // 결과가 너무 크면 단계적 재압축
  // 단계: (maxDim, quality-0.1) → (1024, 0.7) → (1024, 0.6) → (800, 0.6)
  const steps: Array<{ dim: number; q: number }> = [
    { dim: maxDim, q: Math.max(0.6, quality - 0.1) },
    { dim: Math.min(1024, maxDim), q: 0.7 },
    { dim: Math.min(1024, maxDim), q: 0.6 },
    { dim: 800, q: 0.6 },
  ];
  for (const step of steps) {
    if (result === null || estimateDataUrlBytes(result) <= maxBytes) break;
    const next = drawAndEncode(bitmap, step.dim, step.q, false);
    if (next === null) break;
    result = next;
  }

  closeBitmapIfNeeded(bitmap);
  return result || originalDataUrl;
}

// ----------------------------------------------------------------------------
// 내부 유틸
// ----------------------------------------------------------------------------

function drawAndEncode(
  source: ImageBitmap | HTMLImageElement,
  maxDim: number,
  quality: number,
  isPng: boolean,
): string | null {
  try {
    const sw = (source as ImageBitmap).width || (source as HTMLImageElement).naturalWidth;
    const sh = (source as ImageBitmap).height || (source as HTMLImageElement).naturalHeight;
    const { width, height } = fitWithin(sw, sh, maxDim);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
    return canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);
  } catch {
    return null;
  }
}

/**
 * EXIF orientation 을 반영한 비트맵을 얻는다.
 *   - createImageBitmap(file, {imageOrientation:'from-image'}) 가 가능한 환경
 *     (대부분의 최신 브라우저)에서 회전 자동 보정
 *   - 미지원 환경에서는 일반 Image 로 fallback (회전은 못 잡지만 그려지긴 함)
 */
async function loadOriented(file: File, fallbackDataUrl: string): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
    } catch {
      // 옵션 미지원 → 옵션 없이 한 번 더 시도
      try {
        return await createImageBitmap(file);
      } catch {
        // fallback 으로 진행
      }
    }
  }
  return loadImage(fallbackDataUrl);
}

function closeBitmapIfNeeded(b: ImageBitmap | HTMLImageElement) {
  if (typeof (b as ImageBitmap).close === 'function') {
    try { (b as ImageBitmap).close(); } catch { /* noop */ }
  }
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fitWithin(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const r = w > h ? max / w : max / h;
  return { width: Math.round(w * r), height: Math.round(h * r) };
}

/**
 * dataURL 의 디코드 후 바이트 추정값.
 *   data:[mime];base64,<payload>
 * payload 길이 * 0.75 가 실제 바이트.
 */
export function estimateDataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  if (i < 0) return 0;
  const payload = dataUrl.length - i - 1;
  return Math.round(payload * 0.75);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
