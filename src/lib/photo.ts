// ----------------------------------------------------------------------------
// 프로젝트 사진 헬퍼
// ----------------------------------------------------------------------------
// v5 이하: photos 가 string[] (dataURL)
// v6 이상: photos 가 ProjectPhoto[] 객체 배열
// 목록/카드에서 대표 사진을 뽑을 때 두 형태를 모두 안전하게 처리한다.

import type { Project, ProjectPhoto } from '@/lib/db';

/** 삭제되지 않은 사진들의 dataUrl 목록 (레거시 string[] 도 지원) */
export function photoUrls(photos?: Project['photos'] | string[] | null): string[] {
  if (!Array.isArray(photos)) return [];
  return (photos as any[])
    .map(p => {
      if (typeof p === 'string') return p;
      if (p && typeof p === 'object' && !p.isDeleted) return (p as ProjectPhoto).dataUrl;
      return undefined;
    })
    .filter((url): url is string => typeof url === 'string' && url.length > 0);
}

/** 대표(첫 번째) 사진의 dataUrl. 없으면 undefined */
export function coverPhotoUrl(photos?: Project['photos'] | string[] | null): string | undefined {
  return photoUrls(photos)[0];
}
