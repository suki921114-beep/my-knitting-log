// ----------------------------------------------------------------------------
// 클라우드 사진 보관 용량 상한 (순수 함수)
// ----------------------------------------------------------------------------
// 사진을 클라우드에 올리면 저장·전송 비용이 발생한다. 사용자를 막으려는 게
// 아니라 폭주를 막는 브레이크로, 1인당 상한을 둔다.
//
// 압축 설정(1280px / WebP / 최대 800KB)에서 사진 한 장은 보통 150~250KB 다.
// 1GB 면 대략 4,000~6,000장으로, 일반적인 사용에서는 닿기 어렵다.
//
// Firestore / Storage 에 의존하지 않는 계산만 담아 테스트 가능하게 한다.

/** 1인당 무료 보관 용량 */
export const FREE_QUOTA_BYTES = 1024 * 1024 * 1024; // 1GB

/**
 * 사진 한 장의 최대 크기.
 * 압축을 거치면 800KB 를 넘지 않지만, 압축이 실패했거나 우회된 경우를 대비해
 * Storage 보안 규칙에서도 같은 값으로 막는다. (storage.rules 와 값을 맞출 것)
 */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2MB

export interface StorageUsage {
  /** 클라우드에 올라간 사진의 총 바이트 */
  bytes: number;
  photoCount: number;
  updatedAt: number;
}

export const EMPTY_USAGE: StorageUsage = { bytes: 0, photoCount: 0, updatedAt: 0 };

/**
 * dataURL 의 실제 바이트 수.
 * 'data:image/webp;base64,AAAA...' 에서 base64 부분만 보고 계산한다.
 * (base64 는 3바이트를 4글자로 표현하고, 끝의 '=' 는 패딩)
 */
export function dataUrlBytes(dataUrl: string | undefined): number {
  if (!dataUrl) return 0;
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const body = dataUrl.slice(comma + 1);
  if (!dataUrl.slice(0, comma).includes('base64')) return body.length;

  let padding = 0;
  if (body.endsWith('==')) padding = 2;
  else if (body.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
}

/** 1024 단위로 읽기 좋게 — 0.9GB / 320MB / 12KB */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0MB';
  const units: Array<[number, string, number]> = [
    [1024 ** 3, 'GB', 1],
    [1024 ** 2, 'MB', 0],
    [1024, 'KB', 0],
  ];
  for (const [size, unit, digits] of units) {
    if (bytes >= size) {
      const v = bytes / size;
      // 1.0GB 처럼 보이지 않도록 정수면 소수점을 떼어 준다
      const s = v.toFixed(digits);
      return `${s.endsWith('.0') ? s.slice(0, -2) : s}${unit}`;
    }
  }
  return `${bytes}B`;
}

/** 0~1 사이 사용 비율 */
export function usageRatio(bytes: number, quota: number = FREE_QUOTA_BYTES): number {
  if (quota <= 0) return 0;
  return Math.min(1, Math.max(0, bytes / quota));
}

export type UploadRejection = 'photo-too-large' | 'quota-exceeded';

export interface UploadVerdict {
  ok: boolean;
  reason?: UploadRejection;
}

/**
 * 이 사진을 올려도 되는지 판단한다.
 * 상한을 넘으면 올리지 않을 뿐, 로컬 사진은 그대로 둔다 (기기에서는 계속 보인다).
 */
export function canUpload(
  usage: Pick<StorageUsage, 'bytes'>,
  incomingBytes: number,
  quota: number = FREE_QUOTA_BYTES,
  maxPhotoBytes: number = MAX_PHOTO_BYTES,
): UploadVerdict {
  if (incomingBytes > maxPhotoBytes) return { ok: false, reason: 'photo-too-large' };
  if ((usage.bytes ?? 0) + incomingBytes > quota) return { ok: false, reason: 'quota-exceeded' };
  return { ok: true };
}

/** 남은 용량 (음수 없음) */
export function remainingBytes(
  usage: Pick<StorageUsage, 'bytes'>,
  quota: number = FREE_QUOTA_BYTES,
): number {
  return Math.max(0, quota - (usage.bytes ?? 0));
}

/** 사용자에게 보여 줄 안내 문구 */
export function describeRejection(reason: UploadRejection): string {
  switch (reason) {
    case 'photo-too-large':
      return `사진 한 장이 ${formatBytes(MAX_PHOTO_BYTES)}를 넘어 올리지 못했어요.`;
    case 'quota-exceeded':
      return `클라우드 보관 용량 ${formatBytes(FREE_QUOTA_BYTES)}를 다 썼어요. 사진은 기기에 그대로 있어요.`;
  }
}
