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
          본 방침은 서비스 운영 상황에 따라 변경될 수 있으며, 중요한 변경이 있을 때는
          시행일과 함께 갱신하여 안내합니다.
        </p>

        <Section title="1. 서비스명">
          <p>뜨개일기 (이하 '본 서비스')</p>
        </Section>

        <Section title="2. 처리하는 개인정보 항목">
          <p>본 서비스는 서비스 제공을 위해 아래 정보를 저장하거나 처리할 수 있습니다.</p>
          <ul className="ml-4 mt-1 list-disc space-y-1">
            <li>Google 계정 식별자(UID), 이메일, 표시 이름, 프로필 사진 URL</li>
            <li>이용자가 직접 입력한 뜨개 기록 데이터: 실/도안/바늘/부자재/프로젝트/단수 카운터/게이지/메모 등</li>
            <li>이용자가 추가한 사진(기기에 저장되며, 클라우드 백업 시 함께 저장됩니다)</li>
            <li>
              이용자가 도안에 첨부한 PDF 파일(기기에 저장되며, 클라우드 백업이 열린 계정에서는
              함께 저장됩니다)
            </li>
            <li>마지막 백업 시각, 자동 백업 모드, 휴지통 상태 등 동작 메타</li>
            <li>
              <strong className="text-foreground">의견을 보낼 때에 한해</strong>: 이용자가 작성한 신고 내용,
              앱 버전, 기기·브라우저 정보, 화면 크기, 오류 발생 시각과 오류 메시지
            </li>
          </ul>
          <p className="mt-1 text-muted-foreground">
            ※ 오류 정보는 자동으로 수집되지 않습니다. 설정 → 의견 보내기에서 이용자가 직접
            '보내기' 를 눌렀을 때만 전송됩니다.
          </p>
        </Section>

        <Section title="3. 처리 목적">
          <ul className="ml-4 list-disc space-y-1">
            <li>로그인 및 계정 식별</li>
            <li>여러 기기 간 뜨개 기록 동기화</li>
            <li>이용자 본인의 데이터 백업/복원</li>
            <li>이용자가 신고한 오류의 원인 파악 및 수정</li>
          </ul>
        </Section>

        <Section title="4. 저장 위치">
          <ul className="ml-4 list-disc space-y-1">
            <li>이용자의 기기(브라우저 내부 저장소) — 모든 입력 데이터의 1차 저장소</li>
            <li>Google Cloud Firestore — 로그인한 이용자의 UID 경로 아래에만 저장. 다른 이용자는 접근할 수 없도록 보안 규칙이 적용됩니다.</li>
            <li>
              Google Cloud Storage — 이용자가 클라우드 백업을 실행하면 사진과 도안 PDF 파일이
              본인 UID 경로 아래에 저장됩니다. 다른 이용자는 접근할 수 없도록 보안 규칙이 적용됩니다.
            </li>
            <li>
              보내주신 의견은 Google Cloud Firestore 에 별도로 저장되며, 운영자만 열람할 수 있습니다.
              문제 해결 후 또는 1년 이내에 삭제합니다.
            </li>
          </ul>
        </Section>

        <Section title="5. 사진 정책">
          <p>
            사진은 기기에 저장되며, 이용자가 클라우드 백업을 실행하면 Google Cloud Storage 에도
            함께 저장되어 다른 기기에서 볼 수 있습니다. 클라우드 보관 용량은 계정당 1GB 이며,
            남은 용량은 설정 → 백업에서 확인할 수 있습니다. 용량을 넘으면 초과한 사진은
            업로드되지 않고 기기에만 남습니다.
          </p>
          <p className="mt-1 text-muted-foreground">
            ※ 클라우드 백업은 현재 운영자가 지정한 계정에서만 제공됩니다. 그 외 계정에서는
            사진이 기기에만 저장되며 클라우드로 전송되지 않습니다.
          </p>
          <p className="mt-1 text-muted-foreground">
            ※ 이 기능이 유료로 전환되면 본 방침을 갱신하고 이용자에게 별도로 안내합니다.
          </p>
        </Section>

        <Section title="6. 보관 기간">
          <p>
            이용자가 직접 삭제하기 전까지 본인 데이터를 계속 보관합니다.
            이용자가 휴지통에서 항목을 영구 삭제하면 이 기기에서 즉시 제거되며,
            클라우드의 동기화 기록도 다음 동기화 시 동일 상태로 반영됩니다.
          </p>
          <p>
            계정 삭제(아래 7항) 시에는 클라우드에 저장된 기록·사진·도안 PDF 파일을 모두 함께 삭제합니다.
          </p>
        </Section>

        <Section title="7. 이용자의 권리 (조회·수정·삭제·탈퇴)">
          <ul className="ml-4 list-disc space-y-1">
            <li>설정 → 백업 및 동기화의 '내 기기로 내보내기' 로 본인 데이터 조회/이전 가능</li>
            <li>설정 → 데이터 관리의 휴지통에서 삭제된 항목 영구 삭제 가능</li>
            <li>설정 → 데이터 관리의 '전체 삭제' 로 이 기기의 모든 데이터를 한 번에 삭제 가능</li>
            <li>
              <strong className="text-foreground">설정 → 계정 → '계정 삭제(탈퇴)'</strong> 에서
              계정과 클라우드에 저장된 모든 데이터를 앱 안에서 직접 즉시 삭제할 수 있습니다.
              삭제 시 이 기기의 기록을 함께 지울지 선택할 수 있습니다.
            </li>
            <li>
              앱을 사용할 수 없는 상황이라면 아래 9항의 문의 이메일로 삭제를 요청해 주세요.
              요청 확인 후 7일 안에 처리합니다.
            </li>
          </ul>
        </Section>

        <Section title="8. 제3자 제공">
          <p>
            본 서비스는 이용자의 개인정보를 제3자에게 제공하거나 판매하지 않습니다.
            다만 서비스 제공을 위해 아래 인프라(처리 위탁)를 사용합니다.
          </p>
          <ul className="ml-4 mt-1 list-disc space-y-1">
            <li>
              Google LLC — Firebase Authentication (로그인), Firestore (기록 데이터 저장),
              Cloud Storage (사진 및 도안 PDF 저장)
            </li>
            <li>Vercel Inc. — 웹 호스팅 (HTTPS 트래픽)</li>
          </ul>
          <p className="mt-1 text-muted-foreground">
            위 사업자들은 각자의 개인정보처리방침에 따라 데이터를 처리합니다.
          </p>
        </Section>

        <Section title="9. 문의처">
          <p>개인정보 관련 문의/탈퇴 요청은 아래 이메일로 보내주세요.</p>
          <p className="mt-1">
            <LegalPlaceholder value={OPERATOR_EMAIL} fallback="문의 이메일은 정식 출시 시 공개될 예정입니다." />
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
