import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { useConfirm } from '@/hooks/useConfirm';
import { useAuth } from '@/hooks/useAuth';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import {
  ChevronRight,
  UserCircle2,
  LogOut,
  LogIn,
  CloudDownload,
  Database,
  Info,
  ShieldCheck,
  FileText,
  Bug,
  UserX,
} from 'lucide-react';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();

  // 휴지통 카운트 (데이터 관리 메뉴 옆 작은 배지)
  const trashCount = useLiveQuery(async () => {
    const [y, p, n, no, pr, rc, pg] = await Promise.all([
      db.yarns.filter(x => x.isDeleted === true).count(),
      db.patterns.filter(x => x.isDeleted === true).count(),
      db.needles.filter(x => x.isDeleted === true).count(),
      db.notions.filter(x => x.isDeleted === true).count(),
      db.projects.filter(x => x.isDeleted === true).count(),
      db.rowCounters.filter(x => x.isDeleted === true).count(),
      db.projectGauges.filter(x => x.isDeleted === true).count(),
    ]);
    return y + p + n + no + pr + rc + pg;
  }, []) ?? 0;

  return (
    <div className="space-y-6 pb-28">
      <PageHeader title="설정" />
      {dialog}

      {/* 1. 계정 */}
      <Section title="계정">
        {user ? (
          <div className="card-soft overflow-hidden">
            <div className="flex items-center gap-4 p-4 border-b border-border/60 bg-card">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="h-12 w-12 rounded-full object-cover shadow-sm" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <UserCircle2 className="h-7 w-7" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[14px] font-bold text-foreground truncate">{user.displayName || '사용자'}</div>
                  <span className="rounded-md bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 text-[9px] font-bold text-green-700 dark:text-green-400">
                    연결됨
                  </span>
                </div>
                <div className="text-[11.5px] text-muted-foreground truncate mt-0.5">{user.email}</div>
              </div>
            </div>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: '로그아웃 할까요?',
                  description: '이 기기의 기록은 그대로 남아요. 다시 로그인하면 클라우드 백업을 이어서 쓸 수 있어요.',
                  confirmLabel: '로그아웃',
                  destructive: false,
                });
                if (ok) await logout();
              }}
              className="flex w-full items-center gap-3 p-4 transition-colors active:bg-muted/50 hover:bg-muted/30"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <LogOut className="h-4 w-4" />
              </span>
              <div className="text-[13.5px] font-semibold text-foreground text-left flex-1">로그아웃</div>
            </button>
            <button
              onClick={() => navigate('/settings/delete-account')}
              className="flex w-full items-center gap-3 border-t border-border/60 p-4 transition-colors active:bg-destructive/10 hover:bg-destructive/5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <UserX className="h-4 w-4" />
              </span>
              <div className="flex-1 text-left">
                <div className="text-[13.5px] font-semibold text-destructive">계정 삭제 (탈퇴)</div>
                <div className="text-[11px] text-destructive/70">계정과 클라우드 데이터를 영구 삭제</div>
              </div>
              <ChevronRight className="h-4 w-4 text-destructive/50" />
            </button>
          </div>
        ) : (
          <div className="card-soft overflow-hidden">
            <div className="flex items-center gap-4 p-4 border-b border-border/60 bg-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <UserCircle2 className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[14px] font-bold text-foreground">게스트 모드</div>
                  <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-secondary-foreground tracking-wide">
                    OFFLINE
                  </span>
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">데이터를 동기화하려면 로그인하세요</div>
              </div>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="flex w-full items-center gap-3 p-4 transition-colors active:bg-muted/50 hover:bg-muted/30"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LogIn className="h-4 w-4" />
              </span>
              <div className="flex-1 text-left text-[13.5px] font-semibold text-foreground">계정 연결 (로그인)</div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </Section>

      {/* 2. 백업 및 동기화 */}
      <Section title="백업 및 동기화">
        <MenuCard
          icon={CloudDownload}
          tone="primary"
          title="클라우드 백업 · 자동 백업"
          desc="가져오기, 자동 백업, 마지막 결과, 파일 백업"
          onClick={() => navigate('/settings/backup')}
        />
      </Section>

      {/* 3. 데이터 관리 */}
      <Section title="데이터 관리">
        <MenuCard
          icon={Database}
          tone="muted"
          title="데이터 관리"
          desc="휴지통, 전체 삭제"
          badge={trashCount > 0 ? trashCount : undefined}
          onClick={() => navigate('/settings/data')}
        />
      </Section>

      {/* 4. 정책 및 정보 */}
      <Section title="정책 및 정보">
        <MenuCard
          icon={ShieldCheck}
          tone="soft"
          title="개인정보처리방침"
          desc="데이터 저장 위치, 보관 기간, 탈퇴 요청"
          onClick={() => navigate('/privacy')}
        />
        <MenuCard
          icon={FileText}
          tone="muted"
          title="이용약관"
          desc="서비스 목적, 책임 한계, 변경 가능성"
          onClick={() => navigate('/terms')}
        />
        <MenuCard
          icon={Info}
          tone="muted"
          title="앱 정보"
          desc="버전, 오픈소스 라이선스, 문의처"
          onClick={() => navigate('/about')}
        />
      </Section>

      {/* 5. 버그 신고 */}
    <Section title="버그 신고">
      <MenuCard
        icon={Bug}
        tone="muted"
        title="버그 신고"
        desc="문제 상황과 에러 로그 복사하기"
        onClick={() => navigate('/settings/bug-report')}
      />
    </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="section-title">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function MenuCard({
  icon: Icon, tone, title, desc, badge, onClick,
}: {
  icon: any;
  tone: 'primary' | 'muted' | 'soft';
  title: string;
  desc: string;
  badge?: number;
  onClick: () => void;
}) {
  const iconBg =
    tone === 'primary' ? 'bg-primary text-primary-foreground'
    : tone === 'soft' ? 'bg-primary-soft text-primary'
    : 'bg-muted text-muted-foreground';
  return (
    <button
      onClick={onClick}
      className="card-soft flex w-full items-center gap-3 p-4 transition active:scale-[0.99] hover:shadow-soft bg-card"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-[13.5px] font-semibold text-foreground">{title}</div>
        <div className="text-[11.5px] text-muted-foreground">{desc}</div>
      </div>
      {typeof badge === 'number' && badge > 0 && (
        <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10.5px] font-bold text-amber-700 dark:text-amber-400 tabular-nums">
          {badge}
        </span>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}


