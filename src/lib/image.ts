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
  /** 인코딩 quality (0~1). 기본 0.8. */
  quality?: number;
  /**
   * 결과 dataURL 의 최대 byte 크기. 초과 시 quality/maxDim 을 단계적으로
   * 낮춰 재시도. 기본 800KB.
   */
  maxBytes?: number;
};

const DEFAULTS: Required<Omit<CompressOptions, 'maxBytes'>> & { maxBytes: number } = {
  maxDim: 1280,
  quality: 0.8,
  maxBytes: 800 * 1024,
};

/**
 * WebP 인코딩 지원 여부 (1회 검사 후 캐시).
 * WebP 는 같은 체감 화질에서 JPEG 대비 30~40% 작고 투명도도 보존한다.
 * 안드로이드 WebView / 최신 브라우저 모두 지원하며, 미지원 환경에서는
 * 기존처럼 JPEG(또는 PNG) 로 떨어진다.
 */
let webpSupport: boolean | null = null;
export function supportsWebP(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

export async function fileToCompressedDataUrl(
  file: File,
  opts: CompressOptions = {},
): Promise<string> {
  const { maxDim, quality, maxBytes } = { ...DEFAULTS, ...opts };
  const isPng = file.type === 'image/png';
  // WebP 를 쓸 수 있으면 원본 형식과 무관하게 WebP 로 인코딩.
  // 불가능하면 PNG 는 PNG 로(투명도 보존), 나머지는 JPEG 으로.
  const mime: string = supportsWebP() ? 'image/webp' : isPng ? 'image/png' : 'image/jpeg';
  // PNG 만 quality 가 무시되는 무손실 경로 — 단계적 재압축이 무의미하다.
  const lossless = mime === 'image/png';

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
  let result = drawAndEncode(bitmap, maxDim, quality, mime);
  if (result === null) {
    return originalDataUrl;
  }

  // 무손실(PNG) 경로는 quality 가 무시되므로 progressive 가 무의미 → 그대로 반환
  if (lossless) {
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
    const next = drawAndEncode(bitmap, step.dim, step.q, mime);
    if (next === null) break;
    result = next;
  }

  closeBitmapIfNeeded(bitmap);
  return result || originalDataUrl;
}

/**
 * 이미 저장된 dataURL 을 더 작게 다시 인코딩한다.
 *
 * 넣을 때 거르는 것과 별개로 필요하다. 크기 검사가 생기기 전에 들어온 사진,
 * 그리고 압축이 실패해 원본이 그대로 들어온 사진(HEIC 디코드 실패 등)이
 * 기기에 남아 있다. 그런 사진은 클라우드 한 장 상한(2MB)에 걸려 영영 안 올라간다.
 *
 * 줄이지 못하면 원본을 그대로 돌려준다 — 여기서 실패해도 백업 자체는 이어져야 한다.
 */
export async function shrinkDataUrl(
  dataUrl: string | undefined,
  opts: CompressOptions = {},
): Promise<string | undefined> {
  if (!dataUrl) return dataUrl;
  const { maxDim, quality, maxBytes } = { ...DEFAULTS, ...opts };
  if (estimateDataUrlBytes(dataUrl) <= maxBytes) return dataUrl;

  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch {
    // 이 형식은 브라우저가 못 읽는다. 줄일 방법이 없다.
    return dataUrl;
  }

  const mime = supportsWebP() ? 'image/webp' : 'image/jpeg';
  let result = drawAndEncode(img, maxDim, quality, mime);
  if (!result) return dataUrl;

  for (const step of [
    { dim: maxDim, q: Math.max(0.6, quality - 0.1) },
    { dim: Math.min(1024, maxDim), q: 0.7 },
    { dim: 800, q: 0.6 },
    { dim: 640, q: 0.5 },
  ]) {
    if (estimateDataUrlBytes(result) <= maxBytes) break;
    const next = drawAndEncode(img, step.dim, step.q, mime);
    if (!next) break;
    result = next;
  }

  // 줄인 것이 더 크면(작은 PNG 를 WebP 로 바꾼 경우 등) 원본을 쓴다
  return estimateDataUrlBytes(result) < estimateDataUrlBytes(dataUrl) ? result : dataUrl;
}

// ----------------------------------------------------------------------------
// 내부 유틸
// ----------------------------------------------------------------------------

function drawAndEncode(
  source: ImageBitmap | HTMLImageElement,
  maxDim: number,
  quality: number,
  mime: string,
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
    const out = canvas.toDataURL(mime, quality);
    // 브라우저가 요청한 mime 을 지원하지 않으면 PNG 로 떨어진다 —
    // 그 경우 JPEG 으로 한 번 더 시도해 용량 폭증을 막는다.
    if (mime !== 'image/png' && !out.startsWith(`data:${mime}`)) {
      return canvas.toDataURL('image/jpeg', quality);
    }
    return out;
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
