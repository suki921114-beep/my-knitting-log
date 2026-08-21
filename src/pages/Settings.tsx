import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { useConfirm } from '@/hooks/useConfirm';
import AppInfoDialog from '@/components/AppInfoDialog';
import { useAuth } from '@/hooks/useAuth';
import { isProAccount } from '@/lib/entitlement';
import { SHOW_CLOUD_BACKUP_INTRO } from '@/lib/featureFlags';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import {
  ChevronRight,
  UserCircle2,
  LogOut,
  LogIn,
  CloudDownload,
  Database,
  Bug,
} from 'lucide-react';

export default function Settings() {
  const { user, logout } = useAuth();
  const isPro = isProAccount(user);
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
    <div className="space-y-6">
      <PageHeader title="설정" />
      {dialog}

      {/* 1. 계정
          ⚠️ 로그인해도 지금은 클라우드 백업이 명단 계정에만 열린다.
             그래서 아직 못 쓰는 사람에게는 로그인 자리를 내놓지 않는다 —
             눌러서 로그인했는데 아무것도 안 달라지면 고장으로 읽힌다.
             (로그인해 둔 사람에게는 계정과 로그아웃이 그대로 보인다) */}
      {(user || SHOW_CLOUD_BACKUP_INTRO) && (
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
                  {/* 로그인만으로는 클라우드 백업이 열리지 않는다.
                      '연결됨' 하나로 뭉뚱그리면 되는 줄 알고 기다리게 된다. */}
                  {isPro ? (
                    <span className="rounded-md bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      클라우드 백업 사용 중
                    </span>
                  ) : (
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-secondary-foreground">
                      로그인됨
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] text-muted-foreground truncate mt-0.5">{user.email}</div>
              </div>
            </div>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: '로그아웃 할까요?',
                  description: '이 기기의 기록은 그대로 남아요. 다시 로그인하면 이어서 쓸 수 있어요.',
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
                <div className="text-[11.5px] text-muted-foreground mt-0.5">기록은 이 기기에 저장돼요</div>
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
      )}

      {/* 2. 백업 및 동기화 */}
      <Section title="백업 및 동기화">
        <MenuCard
          icon={CloudDownload}
          tone="primary"
          title={isPro ? '클라우드 백업 · 파일 백업' : '백업'}
          desc={isPro ? '클라우드에 올리기, 가져오기, 파일로 내보내기' : '파일로 내보내기, 파일에서 가져오기'}
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

      {/* 4. 의견 보내기 — 버그 신고와 개선 제안을 함께 받는다 */}
      <Section title="의견 보내기">
        <MenuCard
          icon={Bug}
          tone="muted"
          title="의견 보내기"
          desc="불편한 점이나 있으면 좋겠는 기능을 알려주세요"
          onClick={() => navigate('/settings/bug-report')}
        />
      </Section>

      {/* 앱 정보 — 방침/약관/오픈소스는 여기 안에 묶어 둔다 */}
      <div className="border-t border-border/60 pt-2">
        <AppInfoDialog />
      </div>

      {/* 계정 삭제 — 파괴적 동작이라 눈에 띄지 않게 맨 아래 작은 링크로 둔다 */}
      {user && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => navigate('/settings/delete-account')}
            className="text-[11.5px] text-muted-foreground/70 underline underline-offset-4 hover:text-muted-foreground"
          >
            계정 삭제
          </button>
        </div>
      )}
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


