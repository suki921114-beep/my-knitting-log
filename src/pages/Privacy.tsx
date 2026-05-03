import PageHeader from '@/components/PageHeader';
import { LegalPlaceholder } from '@/components/LegalPlaceholder';
import { EFFECTIVE_DATE, OPERATOR_EMAIL } from '@/lib/legalPlaceholders';

export default function Privacy() {
  return (
    <div className="space-y-5">
      <PageHeader title="개인정보처리방침" back />

      <article className="card-soft space-y-5 p-5 text-[13px] leading-[1.65] text-foreground">
        <p className="text-muted-foreground">
          시행일: <LegalPlaceholder value={EFFECTIVE_DATE} fallback="출시일 미정" variant="inline" />
        </p>
        <p className="text-[12px] text-muted-foreground">
          본 방침은 변호사 검토를 받은 문서가 아닙니다. 서비스 운영 중 변경될 수 있으며,
          중요한 변경이 있을 때는 시행일과 함께 갱신됩니다.
        </p>

        <Section title="1. 서비스명">
          <p>나의 뜨개 프로젝트 기록 (이하 '본 서비스')</p>
        </Section>

        <Section title="2. 처리하는 개인정보 항목">
          <p>본 서비스는 다음 정보를 처리합니다.</p>
          <ul className="ml-4 mt-1 list-disc space-y-1">
            <li>Google 계정 식별자(UID), 이메일, 표시 이름, 프로필 사진 URL</li>
            <li>이용자가 직접 입력한 뜨개 기록 데이터: 실/도안/바늘/부자재/프로젝트/단수 카운터/게이지/메모 등</li>
            <li>이용자가 추가한 사진(현재는 이 기기 안에만 저장됩니다)</li>
            <li>마지막 백업 시각, 자동 백업 모드, 휴지통 상태 등 동작 메타</li>
          </ul>
        </Section>

        <Section title="3. 처리 목적">
          <ul className="ml-4 list-disc space-y-1">
            <li>로그인 및 계정 식별</li>
            <li>여러 기기 간 뜨개 기록 동기화</li>
            <li>이용자 본인의 데이터 백업/복원</li>
          </ul>
        </Section>

        <Section title="4. 저장 위치">
          <ul className="ml-4 list-disc space-y-1">
            <li>이 기기 (브라우저 IndexedDB) — 모든 입력 데이터의 1차 저장소</li>
            <li>Google Cloud Firestore — 로그인한 이용자의 UID 경로 아래에만 저장. 다른 이용자는 보안 규칙으로 접근 차단.</li>
            <li>사진은 현재 클라우드에 저장하지 않으며, 이 기기 안에만 보관됩니다.</li>
          </ul>
        </Section>

        <Section title="5. 사진 정책">
          <p>
            현재 무료 백업에는 사진이 포함되지 않으며, 사진은 이용자의 기기 안에만 저장됩니다.
            여러 기기에서 동일한 사진을 보고 싶다면 향후 추가될 프리미엄 기능을 이용해야 합니다.
          </p>
          <p className="mt-1 text-muted-foreground">
            ※ 프리미엄 사진 백업 기능이 도입되면 본 방침을 갱신하고 이용자에게 별도로 안내합니다.
          </p>
        </Section>

        <Section title="6. 보관 기간">
          <p>
            이용자가 직접 삭제하기 전까지 본인 데이터를 계속 보관합니다.
            이용자가 휴지통에서 항목을 영구 삭제하면 이 기기에서 즉시 제거되며,
            클라우드의 동기화 기록도 다음 동기화 시 동일 상태로 반영됩니다.
          </p>
          <p>
            계정 삭제(아래 7항) 요청 시에는 합리적인 기간 안에 모든 백업 데이터를 함께 삭제합니다.
          </p>
        </Section>

        <Section title="7. 이용자의 권리 (조회·수정·삭제·탈퇴)">
          <ul className="ml-4 list-disc space-y-1">
            <li>설정 → 백업 및 동기화의 'JSON 파일로 내보내기' 로 본인 데이터 조회/이전 가능</li>
            <li>설정 → 데이터 관리의 휴지통에서 삭제된 항목 영구 삭제 가능</li>
            <li>설정 → 데이터 관리의 '전체 삭제' 로 이 기기의 모든 데이터를 한 번에 삭제 가능</li>
            <li>계정/클라우드 데이터 완전 삭제(탈퇴) 요청은 아래 9항의 문의 이메일로 보내주세요. 요청 확인 후 7일 안에 처리합니다.</li>
          </ul>
        </Section>

        <Section title="8. 제3자 제공">
          <p>
            본 서비스는 이용자의 개인정보를 제3자에게 제공하거나 판매하지 않습니다.
            다만 서비스 제공을 위해 아래 인프라(처리 위탁)를 사용합니다.
          </p>
          <ul className="ml-4 mt-1 list-disc space-y-1">
            <li>Google LLC — Firebase Authentication (로그인), Firestore (백업 데이터 저장)</li>
            <li>Vercel Inc. — 웹 호스팅 (HTTPS 트래픽)</li>
          </ul>
          <p className="mt-1 text-muted-foreground">
            위 사업자들은 각자의 개인정보처리방침에 따라 데이터를 처리합니다.
          </p>
        </Section>

        <Section title="9. 문의처">
          <p>개인정보 관련 문의/탈퇴 요청은 아래 이메일로 보내주세요.</p>
          <p className="mt-1">
            <LegalPlaceholder value={OPERATOR_EMAIL} fallback="운영자 이메일 미정" />
          </p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            ※ 출시 시점에 실제 운영용 이메일로 갱신해야 합니다.
          </p>
        </Section>

        <Section title="10. 방침의 변경">
          <p>
            법령 변경, 기능 추가(예: 프리미엄 사진 백업, 유료 기능 도입) 등이 있을 경우 본 방침을 갱신하고
            상단의 '시행일' 을 최신으로 표시합니다.
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
