import { describe, it, expect } from 'vitest';
import { coverPhotoUrl, photoUrls } from '@/lib/photo';
import { estimateDataUrlBytes, formatBytes } from '@/lib/image';

const A = 'data:image/webp;base64,AAAA';
const B = 'data:image/webp;base64,BBBB';

describe('photoUrls', () => {
  it('v6 객체 배열에서 dataUrl 을 뽑는다', () => {
    expect(photoUrls([{ cloudId: '1', dataUrl: A }, { cloudId: '2', dataUrl: B }] as any)).toEqual([A, B]);
  });

  it('삭제된 사진은 제외한다', () => {
    expect(
      photoUrls([
        { cloudId: '1', dataUrl: A, isDeleted: true },
        { cloudId: '2', dataUrl: B },
      ] as any),
    ).toEqual([B]);
  });

  it('업로드만 되고 로컬 캐시가 없는 사진(dataUrl 없음)은 제외한다', () => {
    expect(photoUrls([{ cloudId: '1', storagePath: 'x' }] as any)).toEqual([]);
  });

  it('v5 이하 문자열 배열도 처리한다 (마이그레이션 전 데이터 방어)', () => {
    expect(photoUrls([A, B])).toEqual([A, B]);
  });

  it('빈 값에 안전하다', () => {
    expect(photoUrls(undefined)).toEqual([]);
    expect(photoUrls(null)).toEqual([]);
    expect(photoUrls([])).toEqual([]);
  });
});

describe('coverPhotoUrl', () => {
  it('첫 번째 유효한 사진을 대표로 쓴다', () => {
    expect(coverPhotoUrl([{ cloudId: '1', dataUrl: A }, { cloudId: '2', dataUrl: B }] as any)).toBe(A);
  });

  it('첫 사진이 삭제됐으면 다음 사진을 쓴다', () => {
    expect(
      coverPhotoUrl([{ cloudId: '1', dataUrl: A, isDeleted: true }, { cloudId: '2', dataUrl: B }] as any),
    ).toBe(B);
  });

  it('사진이 없으면 undefined — 깨진 <img> 가 뜨지 않아야 한다 (회귀 방지)', () => {
    expect(coverPhotoUrl(undefined)).toBeUndefined();
    expect(coverPhotoUrl([])).toBeUndefined();
  });

  it('객체를 그대로 반환하지 않는다 (src="[object Object]" 회귀 방지)', () => {
    const cover = coverPhotoUrl([{ cloudId: '1', dataUrl: A }] as any);
    expect(typeof cover).toBe('string');
  });
});

describe('estimateDataUrlBytes', () => {
  it('base64 payload 길이의 3/4 을 바이트로 추정한다', () => {
    // payload 4자 → 3바이트
    expect(estimateDataUrlBytes('data:image/webp;base64,AAAA')).toBe(3);
  });

  it('구분자가 없으면 0', () => {
    expect(estimateDataUrlBytes('not-a-data-url')).toBe(0);
  });
});

describe('formatBytes', () => {
  it('단위를 사람이 읽기 좋게 붙인다', () => {
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(2048)).toBe('2KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5MB');
  });
});
