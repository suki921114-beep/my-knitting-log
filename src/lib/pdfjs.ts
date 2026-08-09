// ----------------------------------------------------------------------------
// pdf.js 불러오기
// ----------------------------------------------------------------------------
// 이 파일은 반드시 import() 로만 부를 것. 위에서 그냥 import 하면 pdf.js 가
// 첫 화면 묶음에 딸려 들어가, 도안을 한 번도 안 여는 사람도 1.5MB 를 받게 된다.
//
//   ✅  const { loadPdfjs } = await import('@/lib/pdfjs');
//   ❌  import { loadPdfjs } from '@/lib/pdfjs';
//
// 일꾼(worker) 은 PDF 를 해석하는 무거운 일을 딴 실로 보내는 장치다.
// 없어도 pdf.js 는 스스로 본 실에서 돌지만, 그동안 화면이 얼어붙는다.

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let ready = false;

export function loadPdfjs(): typeof pdfjs {
  if (!ready) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    ready = true;
  }
  return pdfjs;
}

/**
 * 문서를 여는 공통 설정.
 *
 * cMap 은 글자 코드표다. 한글 도안은 글꼴을 PDF 안에 안 박아 넣은 경우가 많아
 * 이게 없으면 글자가 통째로 깨진다. scripts/copy-pdfjs-assets.mjs 가 앱 안에
 * 함께 넣어 두므로 인터넷 없이도 읽힌다.
 */
export function documentOptions(data: ArrayBuffer) {
  return {
    data,
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    // 도안 PDF 에 입력 양식이 들어 있을 이유가 없다. 꺼두면 처리도 빨라진다.
    enableXfa: false,
    isEvalSupported: false,
  };
}
