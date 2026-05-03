import PageHeader from '@/components/PageHeader';
import { LegalPlaceholder } from '@/components/LegalPlaceholder';
import { OPERATOR_EMAIL, OPERATOR_NAME } from '@/lib/legalPlaceholders';

const APP_VERSION = '0.1.0';

const OSS_LIBS = [
  { name: 'React', license: 'MIT', url: 'https://react.dev' },
  { name: 'Vite', license: 'MIT', url: 'https://vitejs.dev' },
  { name: 'TypeScript', license: 'Apache-2.0', url: 'https://www.typescriptlang.org' },
  { name: 'Tailwind CSS', license: 'MIT', url: 'https://tailwindcss.com' },
  { name: 'Dexie.js', license: 'Apache-2.0', url: 'https://dexie.org' },
  { name: 'React Router', license: 'MIT', url: 'https://reactrouter.com' },
  { name: 'Firebase Web SDK', license: 'Apache-2.0', url: 'https://firebase.google.com' },
  { name: 'Sonner', license: 'MIT', url: 'https://sonner.emilkowal.ski' },
  { name: 'Lucide Icons', license: 'ISC', url: 'https://lucide.dev' },
  { name: 'shadcn/ui', license: 'MIT', url: 'https://ui.shadcn.com' },
];

export default function About() {
  return (
    <div className="space-y-5">
      <PageHeader title="앱 정보" back />

      <article className="card-soft space-y-4 p-5 text-[13px] leading-[1.65] text-foreground">
        <header>
          <h2 className="text-[16px] font-bold">나의 뜨개 프로젝트 기록</h2>
          <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">버전 v{APP_VERSION}</p>
        </header>

        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          뜨개 프로젝트 / 실 / 도안 / 바늘 / 부자재 / 단수 카운터 / 게이지를 한 곳에서 기록하고,
          로그인 시 여러 기기 간 클라우드와 양방향 동기화하는 개인용 기록 도구입니다.
        </p>

        <section className="space-y-1.5">
          <h3 className="text-[13.5px] font-bold">개발 / 운영자</h3>
          <p className="text-[12.5px]">
            <LegalPlaceholder value={OPERATOR_NAME} fallback="운영자 표시 미정" />
          </p>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-[13.5px] font-bold">문의</h3>
          <p className="text-[12.5px]">
            <LegalPlaceholder value={OPERATOR_EMAIL} fallback="운영자 이메일 미정" />
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            ※ 출시 시점에 실제 운영용 이메일로 갱신해야 합니다.
          </p>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-[13.5px] font-bold">사업자 정보</h3>
          <p className="text-[12.5px] text-muted-foreground">
            본 서비스는 현재 유료 결제 / 전자상거래 기능이 없으므로 사업자등록번호 및
            통신판매업 신고 정보를 별도로 표시하지 않습니다. 향후 유료 기능 도입 시
            관련 정보를 추가하여 갱신합니다.
          </p>
        </section>

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
                <span c