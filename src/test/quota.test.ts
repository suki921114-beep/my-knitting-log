import { describe, it, expect } from 'vitest';
import {
  FREE_QUOTA_BYTES,
  MAX_PHOTO_BYTES,
  canUpload,
  dataUrlBytes,
  formatBytes,
  remainingBytes,
  usageRatio,
} from '@/lib/quota';

// ----------------------------------------------------------------------------
// 클라우드 사진 용량 상한
// ----------------------------------------------------------------------------
// 이 계산이 틀리면 곧바로 청구서로 이어진다. 경계값을 촘촘히 본다.

describe('dataUrlBytes — 실제 전송량 계산', () => {
  it('base64 4글자는 3바이트다', () => {
    expect(dataUrlBytes('data:image/webp;base64,AAAA')).toBe(3);
  });

  it('패딩(=)은 바이트에서 뺀다', () => {
    expect(dataUrlBytes('data:image/webp;base64,AAA=')).toBe(2);
    expect(dataUrlBytes('data:image/webp;base64,AA==')).toBe(1);
  });

  it('빈 값이나 형식이 아니면 0', () => {
    expect(dataUrlBytes(undefined)).toBe(0);
    expect(dataUrlBytes('')).toBe(0);
    expect(dataUrlBytes('그냥문자열')).toBe(0);
  });
});

describe('canUpload — 올려도 되는지', () => {
  it('빈 보관함에 작은 사진은 통과', () => {
    expect(canUpload({ bytes: 0 }, 200 * 1024).ok).toBe(true);
  });

  it('장당 상한을 넘으면 거부한다', () => {
    const v = canUpload({ bytes: 0 }, MAX_PHOTO_BYTES + 1);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('photo-too-large');
  });

  it('총량을 넘기는 순간 거부한다 (경계 포함)', () => {
    // 딱 맞게 채우는 것은 허용
    expect(canUpload({ bytes: FREE_QUOTA_BYTES - 1000 }, 1000).ok).toBe(true);
    // 1바이트라도 넘치면 거부
    const v = canUpload({ bytes: FREE_QUOTA_BYTES - 1000 }, 1001);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('quota-exceeded');
  });

  it('이미 가득 찼으면 아무것도 못 올린다', () => {
    expect(canUpload({ bytes: FREE_QUOTA_BYTES }, 1).ok).toBe(false);
  });

  it('장당 상한 검사가 총량 검사보다 먼저다', () => {
    // 둘 다 위반일 때 사용자에게 더 구체적인 이유를 준다
    const v = canUpload({ bytes: FREE_QUOTA_BYTES }, MAX_PHOTO_BYTES + 1);
    expect(v.reason).toBe('photo-too-large');
  });
});

describe('표시용 계산', () => {
  it('사람이 읽는 단위로 바꾼다', () => {
    expect(formatBytes(0)).toBe('0MB');
    expect(formatBytes(1024)).toBe('1KB');
    expect(formatBytes(320 * 1024 * 1024)).toBe('320MB');
    expect(formatBytes(FREE_QUOTA_BYTES)).toBe('1GB');
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.5GB');
  });

  it('사용 비율은 0~1 을 벗어나지 않는다', () => {
    expect(usageRatio(0)).toBe(0);
    expect(usageRatio(FREE_QUOTA_BYTES / 2)).toBeCloseTo(0.5);
    expect(usageRatio(FREE_QUOTA_BYTES * 10)).toBe(1);
    expect(usageRatio(-5)).toBe(0);
  });

  it('남은 용량은 음수가 되지 않는다', () => {
    expect(remainingBytes({ bytes: FREE_QUOTA_BYTES * 2 })).toBe(0);
    expect(remainingBytes({ bytes: 0 })).toBe(FREE_QUOTA_BYTES);
  });
});

describe('상한 값 자체', () => {
  it('1GB / 장당 2MB 로 잡혀 있다 (storage.rules 와 같아야 한다)', () => {
    expect(FREE_QUOTA_BYTES).toBe(1073741824);
    expect(MAX_PHOTO_BYTES).toBe(2097152);
  });
});
