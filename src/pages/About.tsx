import PageHeader from '@/components/PageHeader';
import { LegalPlaceholder } from '@/components/LegalPlaceholder';
import { OPERATOR_EMAIL, OPERATOR_NAME } from '@/lib/legalPlaceholders';

import { APP_VERSION } from '@/lib/appVersion';

/**
 * 테스트를 도와주신 분들의 인스타그램 아이디 (@ 없이).
 *
 * ⚠️ 본인 동의를 받은 아이디만 넣는다. 아이디는 개인을 특정하는 정보라,
 *    고맙다는 뜻이어도 말없이 올리면 곤란해진다. 빼달라고 하면 바로 뺀다.
 *
 * 비어 있으면 'Thanks to' 자리 자체가 안 보인다.
 */
const THANKS_TO: string[] = [
];

// ⚠️ 앱에 실제로 실려 나가는 것만 적는다. 새 라이브러리를 넣으면 여기에도 추가할 것.
//    빠뜨리면 라이선스 고지 의무를 지키지 못한 것이 된다.
const OSS_LIBS = [
  { name: 'React', license: 'MIT', url: 'https://react.dev' },
  { name: 'Vite', license: 'MIT', url: 'https://vitejs.dev' },
  { name: 'TypeScript', license: 'Apache-2.0', url: 'https://www.typescriptlang.org' },
  { name: 'Tailwind CSS', license: 'MIT', url: 'https://tailwindcss.com' },
  { name: 'Dexie.js', license: 'Apache-2.0', url: 'https://dexie.org' },
  { name: 'React Router', license: 'MIT', url: 'https://reactrouter.com' },
  { name: 'Firebase Web SDK', license: 'Apache-2.0', url: 'https://firebase.google.com' },
  { name: 'Capacitor', license: 'MIT', url: 'https://capacitorjs.com' },
  { name: 'PDF.js (pdfjs-dist)', license: 'Apache-2.0', url: 'https://mozilla.github.io/pdf.js' },
  { name: 'Radix UI', license: 'MIT', url: 'https://www.radix-ui.com' },
  { name: 'shadcn/ui', license: 'MIT', url: 'https://ui.shadcn.com' },
  { name: 'TanStack Query', license: 'MIT', url: 'https://tanstack.com/query' },
  { name: 'React Hook Form', license: 'MIT', url: 'https://react-hook-form.com' },
  { name: 'Zod', license: 'MIT', url: 'https://zod.dev' },
  { name: 'date-fns', license: 'MIT', url: 'https://date-fns.org' },
  { name: 'Sonner', license: 'MIT', url: 'https://sonner.emilkowal.ski' },
  { name: 'Lucide Icons', license: 'ISC', url: 'https://lucide.dev' },
];

export default function About() {
  return (
    <div className="space-y-5">
      <PageHeader title="앱 정보" back />

      <article className="card-soft space-y-4 p-5 text-[13px] leading-[1.65] text-foreground">
        <header>
          <h2 className="text-[16px] font-bold">뜨개일기</h2>
          <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">버전 v{APP_VERSION}</p>
        </header>

        {/* ⚠️ "로그인하면 동기화된다" 고 쓰면 안 된다. 클라우드는 지금 명단
            계정에만 열려 있어서, 로그인하고 기다리다 고장으로 여기게 된다. */}
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          프로젝트 · 실 · 도안 · 바늘 · 부자재 · 단수 카운터 · 게이지를 한 곳에 기록하는 뜨개 일기장입니다.
          기록은 내 기기에 저장되고, 설정 → 백업에서 파일로 내보내 옮길 수 있어요.
        </p>

        <section className="space-y-1.5">
          <h3 className="text-[13.5px] font-bold">개발 / 운영자</h3>
          <p className="text-[12.5px]">
            <LegalPlaceholder value={OPERATOR_NAME} fallback="운영자 이름 미정" />
          </p>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-[13.5px] font-bold">문의</h3>
          <p className="text-[12.5px]">
            <LegalPlaceholder value={OPERATOR_EMAIL} fallback="운영자 이메일 미정" />
          </p>
        </section>

        {THANKS_TO.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="text-[13.5px] font-bold">Thanks to</h3>
            <p className="text-[12px] text-muted-foreground">
              출시 전 테스트를 도와주시고 의견을 보내주신 분들입니다. 이분들이 짚어주신 덕분에
              고쳐진 것이 많습니다.
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {THANKS_TO.map(id => (
                <li
                  key={id}
                  className="rounded-full bg-primary-soft px-2.5 py-1 text-[11.5px] font-medium text-primary"
                >
                  @{id}
                </li>
              ))}
            </ul>
          </section>
        )}


        <section className="space-y-1.5">
          <h3 className="text-[13.5px] font-bold">오픈소스 라이선스</h3>
          <p className="text-[12px] text-muted-foreground">
            본 앱은 다음 오픈소스 라이브러리를 사용합니다. 각 라이브러리의 라이선스 전문은
            해당 프로젝트 페이지를 참고해 주세요.
          </p>
          <ul className="mt-2 space-y-1 text-[12px]">
            {OSS_LIBS.map((lib) => (
              <li key={lib.name} className="flex items-baseline justify-between gap-2">
                <a
                  href={lib.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-foreground hover:text-primary"
                >
                  {lib.name}
                </a>
                <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  {lib.license}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  );
}
