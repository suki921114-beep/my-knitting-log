// ----------------------------------------------------------------------------
// 도안 PDF — 기기에만 두는 파일
// ----------------------------------------------------------------------------
// 왜 클라우드에 안 올리는가.
//   도안 PDF 는 한 개가 3~10MB 다. 사람마다 주는 저장 공간이 1GB 인데
//   도안 150개면 꽉 찬다. 사진까지 같이 쓰면 그보다 빨리 찬다.
//   그래서 지금은 기기에만 두고, 클라우드 보관은 나중에 유료로 연다.
//
// 대신 알려야 할 것이 있다.
//   · 앱을 지우면 같이 사라진다
//   · 백업 파일에도 안 들어간다
//   · 아이폰 사파리는 한동안 안 열면 저장한 것을 통째로 비운다
//     (홈 화면에 추가해 두면 덜하지만 보장되지는 않는다)
//
// 마지막 것 때문에 저장할 때 브라우저에 '이건 지우지 말아 달라' 고 한 번 청한다
// — navigator.storage.persist(). 들어줄지는 브라우저가 정한다.

import { db, type PatternFile } from '@/lib/db';

/**
 * 받을 수 있는 파일 크기.
 *
 * 뜨개 도안 PDF 는 사진이 많이 들어가도 20MB 를 넘는 일이 드물다.
 * 한도를 두는 건 저장 공간이 아니라 화면 때문이다 — 100MB 짜리를 열면
 * pdf.js 가 몇 초씩 멈춰 앱이 죽은 것처럼 보인다.
 */
export const MAX_PATTERN_FILE_BYTES = 30 * 1024 * 1024;

export const ACCEPTED_PATTERN_FILE_TYPES = 'application/pdf';

export type SaveFileError = 'type' | 'size' | 'quota' | 'unknown';

export interface SaveFileResult {
  ok: boolean;
  error?: SaveFileError;
  file?: PatternFile;
}

/** 사람이 읽는 크기 — 1.2MB */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** PDF 인지. 확장자만 보는 기기도 있어 둘 다 본다. */
export function isPdf(file: { type?: string; name?: string }): boolean {
  if (file.type === 'application/pdf') return true;
  // 안드로이드 일부 파일 앱은 type 을 비워서 준다
  return !file.type && /\.pdf$/i.test(file.name ?? '');
}

/**
 * 브라우저에 '저장한 것을 함부로 지우지 말아 달라' 고 청한다.
 *
 * 들어주면 저장 공간이 모자랄 때도 이 앱 것은 남는다. 거절해도 저장은 되니
 * 결과로 흐름을 막지 않는다 — 다만 화면에서 안내를 다르게 할 수 있다.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** 도안 하나에 파일 하나. 이미 있으면 갈아 끼운다. */
export async function savePatternFile(patternId: number, file: File): Promise<SaveFileResult> {
  if (!isPdf(file)) return { ok: false, error: 'type' };
  if (file.size > MAX_PATTERN_FILE_BYTES) return { ok: false, error: 'size' };

  const record: PatternFile = {
    patternId,
    name: file.name || '도안.pdf',
    size: file.size,
    type: 'application/pdf',
    blob: file,
    createdAt: Date.now(),
  };

  try {
    await requestPersistentStorage();
    // 지우고 넣는다. 도안 하나에 파일 하나이므로 옛것이 남아 자리를 먹으면 안 된다.
    await db.transaction('rw', db.patternFiles, async () => {
      await db.patternFiles.where('patternId').equals(patternId).delete();
      record.id = (await db.patternFiles.add(record)) as number;
    });
    return { ok: true, file: record };
  } catch (e) {
    console.error('[patternFile] 저장 실패', e);
    // 저장 공간이 모자라면 QuotaExceededError 가 온다
    const name = (e as { name?: string })?.name ?? '';
    return { ok: false, error: name === 'QuotaExceededError' ? 'quota' : 'unknown' };
  }
}

export async function getPatternFile(patternId: number): Promise<PatternFile | undefined> {
  return db.patternFiles.where('patternId').equals(patternId).first();
}

export async function deletePatternFile(patternId: number): Promise<void> {
  await db.patternFiles.where('patternId').equals(patternId).delete();
}

/**
 * 도안이 영구 삭제될 때 딸린 파일도 함께 지운다.
 *
 * 안 지우면 몇 MB 짜리 PDF 가 주인 없이 기기에 남는다. 눈에 보이지도 않아
 * 저장 공간만 먹다가 나중에 '앱이 왜 이렇게 크지' 가 된다.
 */
export async function deletePatternFiles(patternIds: number[]): Promise<void> {
  if (!patternIds.length) return;
  await db.patternFiles.where('patternId').anyOf(patternIds).delete();
}

/**
 * 파일이 붙어 있는 도안 id 들.
 *
 * 목록에서 배지를 다는 데 쓴다. blob 까지 읽으면 목록 한 번 그리는 데
 * 수십 MB 를 읽게 되므로 키만 가져온다.
 */
export async function patternIdsWithFile(): Promise<Set<number>> {
  const ids = await db.patternFiles.orderBy('patternId').keys();
  // orderBy('patternId').keys() 는 색인 값(patternId)을 준다
  return new Set(ids as number[]);
}

/** 도안 파일들이 차지한 크기 (blob 은 안 읽고 size 칸만 더한다) */
export async function totalPatternFileBytes(): Promise<number> {
  let sum = 0;
  await db.patternFiles.each(f => {
    sum += f.size || 0;
  });
  return sum;
}

export interface SaveErrorMessage {
  title: string;
  description?: string;
}

/** 실패 이유를 사람 말로 */
export function saveErrorMessage(error: SaveFileError): SaveErrorMessage {
  switch (error) {
    case 'type':
      return { title: 'PDF 파일만 넣을 수 있어요' };
    case 'size':
      return {
        title: `파일이 너무 커요 (최대 ${formatBytes(MAX_PATTERN_FILE_BYTES)})`,
        description: '도안이 여러 장으로 나뉘어 있다면 필요한 부분만 넣어보세요.',
      };
    case 'quota':
      return {
        title: '기기에 저장 공간이 모자라요',
        description: '다른 도안 파일이나 사진을 정리한 뒤 다시 시도해 주세요.',
      };
    default:
      return { title: '파일을 저장하지 못했어요' };
  }
}
