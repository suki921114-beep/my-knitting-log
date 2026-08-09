// ----------------------------------------------------------------------------
// pdf.js 가 실행 중에 찾아 쓰는 파일들을 public/ 으로 옮긴다
// ----------------------------------------------------------------------------
// pdf.js 는 두 가지를 필요할 때만 내려받는다.
//
//   cmaps          — 글자 코드표. PDF 에 한글 글꼴이 박혀 있지 않으면
//                    이게 없어 글자가 통째로 깨진다. 한글 도안에서 흔하다.
//   standard_fonts — Helvetica 같은 기본 글꼴. 역시 안 박아 넣은 PDF 가 많다.
//
// 인터넷에서 받아오게 둘 수도 있지만, 이 앱은 비행기 안이나 지하철에서도
// 도안을 봐야 한다. 그래서 앱 안에 함께 넣는다 (약 2MB).
//
// node_modules 안의 파일을 그대로 복사하므로 git 에는 담지 않는다
// (.gitignore 의 public/pdfjs). npm install 뒤 build/dev 가 알아서 부른다.

import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'pdfjs-dist');
const to = join(root, 'public', 'pdfjs');

if (!existsSync(from)) {
  console.warn('[pdfjs] node_modules/pdfjs-dist 가 없습니다. npm install 을 먼저 해주세요.');
  process.exit(0);
}

await rm(to, { recursive: true, force: true });
await mkdir(to, { recursive: true });

for (const dir of ['cmaps', 'standard_fonts']) {
  const src = join(from, dir);
  if (!existsSync(src)) {
    console.warn(`[pdfjs] ${dir} 를 찾지 못했습니다. 건너뜁니다.`);
    continue;
  }
  await cp(src, join(to, dir), { recursive: true });
}

console.log('[pdfjs] cmaps / standard_fonts 를 public/pdfjs 로 옮겼습니다.');
