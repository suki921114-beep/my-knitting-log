// ----------------------------------------------------------------------------
// sync 공통 타입 및 유틸
// ----------------------------------------------------------------------------
// 모든 entity별 sync 모듈이 공통으로 사용하는 타입과 헬퍼.
// 동작은 기존 src/lib/sync.ts 와 100% 동일.

export interface FetchDiff<T> {
  toAdd: T[];
  toUpdate: T[];
  unchanged: number;
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  unchanged: number;
  failed: number;
}

export interface FetchResult {
  added: number;
  updated: number;
  unchanged: number;
  failed: number;
}

export interface SyncDiff<T> {
  toUpload: T[];
  toDownload: T[];
  unchanged: number;
}

/**
 * Firestore에 안전하게 올릴 수 있는 형태로 값을 정제한다.
 * - undefined 필드는 제거 (Firestore가 거부)
 * - NaN 은 null 로 치환
 * - 배열/객체는 재귀적으로 정제
 */
export function sanitizeForFirestore(value: any): any {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === "number" && Number.isNaN(value)) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === "object") {
    const result: Record<string, any> = {};

    for (const [key, val] of Object.entries(value)) {
      const sanitized = sanitizeForFirestore(val);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }

    return result;
  }

  return value;
}
