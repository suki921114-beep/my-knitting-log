// Resize + compress image files to a JPEG dataURL for IndexedDB storage.
export async function fileToCompressedDataUrl(
  file: File,
  opts: { maxDim?: number; quality?: number } = {}
): Promise<string> {
  const { maxDim = 1280, quality = 0.82 } = opts;
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);
  const { width, height } = fitWithin(img.width, img.height, maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  // PNG with transparency → keep PNG, otherwise JPEG for size.
  const isPng = file.type === 'image/png';
  return canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);
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
