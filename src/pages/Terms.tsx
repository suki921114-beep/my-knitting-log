import PageHeader from '@/components/PageHeader';
import { LegalPlaceholder } from '@/components/LegalPlaceholder';
import { EFFECTIVE_DATE, OPERATOR_EMAIL } from '@/lib/legalPlaceholders';

export default function Terms() {
  return (
    <div className="space-y-5">
      <PageHeader title="이용약관" back />

      <article className="card-soft space-y-5 p-5 text-[13px] leading-[1.65] text-foreground">
        <p className="text-muted-foreground">
          시행일: <LegalPlaceholder value={EFFECTIVE_DATE} fallback="출시일 미정" variant="inline" />
        </p>
        <p className="text-[12px] text-muted-foreground">
          본 약관은 변호사 검토를 받은 문서가 아닙니다. 서비스 운영 상황에 따라 변경될 수 있으며,
          변경 시 시행일과 함께 안내합니다.
        </p>

        <Section title="1. 서비스 목적">
          <p>
            '뜨개일기' (이하 '본 서비스') 은 이용자가 직접 입력한 뜨개 관련 데이터
            (실/도안/바늘/부자재/프로젝트/단수 카운터/게이지/메모/사진 등) 를 한 곳에 기록하고,
            로그인한 이용자에 한해 클라우드에 올리고 다른 기기에서 가져올 수 있도록
            기록과 관리를 지원하는 서비스입니다.
          </p>
        </Section>

        <Section title="2. 계정 및 데이터 관리 책임">
          <ul className="ml-4 list-disc space-y-1">
            <li>이용자는 본인의 Google 계정으로 로그인하여 서비스를 이용합니다.</li>
            <li>입력한 데이터의 내용 및 관리 책임에 대한 책임은 이용자에게 있습니다.</li>
            <li>이용자는 자신의 계정 자격증명을 관리할 책임이 있습니다.</li>
          </ul>
        </Section>

        <Section title="3. 백업 및 동기화의 한계">
          <p>
            클라우드 백업과 동기화는 보조 기능이며, 네트워크 상태 / 브라우저 / 기기 / Firebase 인프라
            상태에 따라 일시적으로 실패할 수 있습니다.
            <strong className="text-foreground"> 본 서비스는 아래 사항을 보장하지 않습니다.</strong>
          </p>
          <ul className="ml-4 mt-1 list-disc space-y-1">
            <li>모든 데이터가 항상 즉시 클라우드에 반영되는 것</li>
            <li>모든 기기에서 항상 동일한 데이터를 즉시 볼 수 있는 것</li>
            <li>모든 사진이 항상 클라우드에 백업되는 것 (계정당 1GB 상한이 있으며, 초과분은 기기에만 남습니다)</li>
          </ul>
          <p className="mt-1 text-muted-foreground">
            ※ 클라우드 백업은 현재 운영자가 지정한 계정에서만 제공됩니다. 그 외 계정에서는
            설정 → 백업의 '내 기기로 내보내기' 를 이용해 주세요.
          </p>
          <p className="mt-1 text-muted-foreground">
            ※ 도안 PDF 파일과 형광펜 표시는 '내 기기로 내보내기' 파일에 담기지 않습니다.
            원본 파일은 이용자가 별도로 보관해 주세요.
          </p>
          <p className="mt-1 font-semibold">
            중요한 데이터는 이용자가 별도로(설정 → 백업 및 동기화의 '내 기기로 내보내기')
            보관해 둘 책임이 있습니다.
          </p>
        </Section>

        <Section title="4. 서비스 변경 및 중단">
          <p>
            본 서비스는 운영상의 필요에 따라 일부 기능을 변경하거나 중단할 수 있습니다.
            중단 전에는 가능한 범위에서 이용자에게 사전 안내합니다.
          </p>
        </Section>

        <Section title="5. 책임의 제한">
          <p>
            본 서비스는 무료로 제공되며, 운영자는 다음 사항에 대해 법령이 허용하는 한도에서
            책임을 지지 않습니다.
          </p>
          <ul className="ml-4 mt-1 list-disc space-y-1">
            <li>이용자 기기의 손실 / 브라우저 데이터 초기화로 인한 로컬 데이터 유실</li>
            <li>네트워크 장애 / Firebase 등 외부 인프라 장애로 인한 동기화 실패</li>
            <li>이용자가 직접 [전체 삭제] / 영구 삭제 등을 실행해 발생한 데이터 유실</li>
            <li>이용자 본인의 잘못된 입력으로 인한 불이익</li>
          </ul>
        </Section>

        {/* 도안은 대부분 남이 만들어 판 저작물이다. 앱에 넣는 것 자체는
            개인적 이용이라 문제되지 않지만, 이 서비스가 그 파일을 대신
            나눠주는 통로로 쓰이면 곤란해진다. 책임의 소재를 적어 둔다. */}
        <Section title="6. 도안 등 이용자 자료의 저작권">
          <p>
            이용자가 앱에 넣는 도안 PDF·사진 등의 자료에 대한 권리와 책임은 이용자에게 있습니다.
            이용자는 본인이 정당하게 구입했거나 이용 권한을 가진 자료만 저장해야 합니다.
          </p>
          <p className="mt-1">
            저장한 자료는 이용자 본인의 기록·열람 목적으로만 제공되며, 본 서비스는 이용자 간
            자료 공유·전송 기능을 제공하지 않습니다. 이용자가 타인의 저작물을 무단으로 복제·배포하여
            발생한 문제에 대해 운영자는 책임지지 않습니다.
          </p>
        </Section>

        <Section title="7. 금지 행위">
          <ul className="ml-4 list-disc space-y-1">
            <li>본 서비스를 이용하여 타인의 권리를 침해하는 행위</li>
            <li>본 서비스의 인프라(Firebase 등) 에 비정상적인 부하를 가하는 행위</li>
            <li>본 서비스를 무단 복제·재배포·역설계하는 행위</li>
            <li>관련 법령 또는 제3자의 권리를 침해하는 행위</li>
          </ul>
        </Section>

        <Section title="8. 유료 기능">
          <p>
            본 서비스는 모든 기능을 무료로 제공하며 별도의 결제 / 구독 / 광고 수익화 기능이 없습니다.
            현재 클라우드 백업은 운영자가 지정한 계정에서만 제공되고 있으며, 향후 이 기능이
            유료(프리미엄) 로 전환될 수 있습니다. 그 시점에는 별도의 결제 약관 / 환불 정책 /
            사업자 정보를 본 페이지에 추가하여 갱신하고 이용자에게 안내합니다.
          </p>
        </Section>

        <Section title="9. 문의처">
          <p>약관 관련 문의는 아래 이메일로 보내주세요.</p>
          <p className="mt-1">
            <LegalPlaceholder value={OPERATOR_EMAIL} fallback="문의 이메일은 정식 출시 시 공개될 예정입니다." />
          </p>
        </Section>

        <Section title="10. 약관의 변경">
          <p>
            본 약관은 서비스 운영 상황 / 법령 / 기능 변경에 따라 갱신될 수 있으며, 갱신 시 상단의
            '시행일' 을 최신으로 표시합니다.
          </p>
        </Section>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-[14.5px] font-bold text-foreground">{title}</h2>
      <div className="text-[12.5px] leading-relaxed text-foreground">{children}</div>
    </section>
  );
}
