import { describe, it, expect } from 'vitest';
import {
  isPdf,
  formatBytes,
  saveErrorMessage,
  MAX_PATTERN_FILE_BYTES,
} from '@/lib/patternFile';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ----------------------------------------------------------------------------
// 도안 PDF — 기기에만 두기로 한 파일
// ----------------------------------------------------------------------------
// 이 파일들이 클라우드나 백업으로 새면 두 가지가 한꺼번에 무너진다.
//   · Firestore 문서 하나는 1MB 를 못 넘는다. PDF 한 개면 그 자리에서 넘긴다.
//   · 백업 파일은 글자(JSON)라 PDF 가 base64 로 3분의 1 불어난다.
//     도안 스무 개면 백업 한 번에 200MB — 열지도 보내지도 못한다.

describe('PDF 인지 가려내기', () => {
  it('종류가 PDF 면 받는다', () => {
    expect(isPdf({ type: 'application/pdf', name: '스웨터.pdf' })).toBe(true);
  });

  it('종류를 안 알려주는 기기는 이름으로 본다', () => {
    // 안드로이드 일부 파일 앱은 type 을 빈 값으로 준다
    expect(isPdf({ type: '', name: '스웨터.pdf' })).toBe(true);
    expect(isPdf({ name: '스웨터.PDF' })).toBe(true);
  });

  it('PDF 가 아니면 거른다', () => {
    expect(isPdf({ type: 'image/png', name: '도안.png' })).toBe(false);
    expect(isPdf({ type: '', name: '도안.hwp' })).toBe(false);
    // 종류가 PDF 가 아닌데 이름만 pdf 인 척하는 것도 안 받는다
    expect(isPdf({ type: 'application/zip', name: '도안.pdf' })).toBe(false);
  });
});

describe('크기 표기', () => {
  it('사람이 읽는 단위로 바꾼다', () => {
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(2048)).toBe('2KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0MB');
  });

  it('말이 안 되는 값은 빈 글자', () => {
    expect(formatBytes(-1)).toBe('');
    expect(formatBytes(NaN)).toBe('');
  });
});

describe('한도', () => {
  it('30MB 를 넘지 않는다', () => {
    // 한도를 두는 건 저장 공간이 아니라 화면 때문이다 — 큰 파일을 열면
    // pdf.js 가 몇 초씩 멈춰 앱이 죽은 것처럼 보인다.
    expect(MAX_PATTERN_FILE_BYTES).toBe(30 * 1024 * 1024);
  });

  it('실패 이유마다 할 말이 있다', () => {
    for (const e of ['type', 'size', 'quota', 'unknown'] as const) {
      expect(saveErrorMessage(e).title.length).toBeGreaterThan(0);
    }
  });
});

// 아래 둘은 코드를 직접 읽어 확인한다.
// 이 검사에는 IndexedDB 도 Firestore 도 필요 없고, 무엇보다 '누가 실수로
// 한 줄 더했을 때' 를 잡는 것이 목적이라 글로 확인하는 편이 확실하다.
function read(rel: string) {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
}

describe('도안 파일이 새면 안 되는 곳', () => {
  it('백업 파일(exportAll)에 patternFiles 가 없다', () => {
    // 새면 백업 한 번에 수백 MB 가 된다 — 열지도 보내지도 못한다.
    // 클라우드에는 올라가도 파일 백업에는 절대 안 담는다.
    const src = read('../lib/db.ts');
    const body = src.slice(src.indexOf('export async function exportAll'));
    expect(body).not.toContain('patternFiles');
  });

  it('Firestore 문서에는 파일이 아니라 자리만 적는다', () => {
    // fileDataUrl 은 안 쓰는 옛 칸이다. 남아 있는 기기가 있으면 문서와 함께
    // 올라가는데, PDF 한 개면 문서 한도(1MB)를 그 자리에서 넘긴다.
    const src = read('../lib/sync/pattern.ts');
    expect(src).toContain('fileDataUrl: _dropped');
    // 올리는 것은 '자리'(fileStoragePath)뿐이다
    expect(read('../lib/sync/patternFileSync.ts')).toContain('fileStoragePath');
  });

  it('도안 파일 동기화는 신청한 계정에만 열린다', () => {
    // 이 문이 열리면 사람 수만큼 보관 비용이 늘어난다.
    // PDF 는 한 개가 3~10MB 라 사진과는 무게가 다르다.
    const src = read('../lib/sync/patternFileSync.ts');
    expect(src).toContain('isProAccount');
    // 올리기·받기 양쪽 모두 이 판단을 거쳐야 한다
    expect(src).toContain('canSyncPatternFiles()');
    const gates = src.match(/canSyncPatternFiles\(\)/g) ?? [];
    expect(gates.length).toBeGreaterThanOrEqual(3);
  });

  it('예전에 넣어둔 파일도 한 번 더 올려 옮긴다', () => {
    // 백업은 '기기가 더 새로울 때' 만 올린다. 이 확인이 없으면 도안 파일을
    // 올리지 않던 시절에 백업해 둔 도안은 시각이 같아 그냥 넘어가고,
    // PDF 는 영영 기기에만 남는다. (사진에서 똑같이 겪었던 문제다)
    const src = read('../lib/sync/pattern.ts');
    expect(src).toContain('needsPatternFileUpload');
  });

  it('확인하자고 파일을 통째로 읽지 않는다', () => {
    // first() 를 쓰면 '올라갔나' 를 보려고 몇 MB 를 읽는다.
    // 도안이 여럿이면 백업을 누를 때마다 그만큼 읽게 된다.
    const src = read('../lib/sync/patternFileSync.ts');
    const fn = src.slice(src.indexOf('export async function needsPatternFileUpload'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).toContain('.count()');
    expect(body).not.toContain('.first()');
  });

  it('짝은 기기 안 번호가 아니라 cloudId 로 맞춘다', () => {
    // patternId 로 맞추면 폰의 3번 도안 파일이 PC 의 3번(다른 도안)에 붙는다
    const src = read('../lib/sync/patternFileStorage.ts');
    expect(src).toContain('patternCloudId');
    expect(src).not.toContain('patternId');
  });
});
