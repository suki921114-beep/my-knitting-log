import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { deleteAccount, reauthenticate, ReauthRequiredError } from '@/lib/deleteAccount';
import { AlertTriangle, Loader2, UserX, Download, CheckCircle2, ExternalLink } from 'lucide-react';
import { OPERATOR_EMAIL } from '@/lib/legalPlaceholders';

/**
 * 계정 삭제(탈퇴) 화면.
 * Google Play 데이터 삭제 정책상 앱 안에서 계정과 데이터를 지울 수 있어야 한다.
 */
export default function SettingsDeleteAccount() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [alsoClearLocal, setAlsoClearLocal] = useState(true);
  const [typed, setTyped] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);

  const CONFIRM_WORD = '삭제';
  const canProceed = !!user && typed.trim() === CONFIRM_WORD && !busy;

  async function run(afterReauth = false) {
    setBusy(true);
    try {
      await deleteAccount({
        alsoClearLocal,
        onProgress: setProgress,
      });
      setDone(true);
    } catch (e: any) {
      if (e instanceof ReauthRequiredError && !afterReauth) {
        // 보안상 최근 로그인을 요구하는 경우 — 한 번 더 인증받고 재시도
        setProgress('보안 확인을 위해 다시 로그인해 주세요…');
        try {
          await reauthenticate();
          await run(true);
          return;
        } catch (re) {
          console.error('[DeleteAccount] 재인증 실패:', re);
          toast.error('본인 확인에 실패했어요', {
            description: '다시 시도하거나, 로그아웃 후 재로그인한 뒤 진행해 주세요.',
          });
        }
      } else {
        console.error('[DeleteAccount] 삭제 실패:', e);
        toast.error('계정 삭제에 실패했어요', {
          description: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
        });
      }
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  // 삭제 완료 — 재로그인 시 동의 화면 없이 통과하는 이유를 함께 안내한다.
  // (Firebase 계정 삭제와 Google 계정의 앱 사용 허가는 별개)
  if (done) {
    return (
      <div className="space-y-5">
        <PageHeader title="삭제 완료" />
        <div className="card-soft space-y-3 p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <p className="text-[14px] font-semibold text-foreground">계정과 데이터를 삭제했어요</p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            그동안 이용해 주셔서 고맙습니다.
          </p>
        </div>

        <div className="card-soft space-y-2 p-4">
          <p className="text-[12.5px] font-semibold text-foreground">Google 계정 연결도 끊으시려면</p>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            이 앱의 계정은 삭제됐지만, Google 계정에는 "이 앱에 로그인 허용" 기록이 남아 있어요.
            그래서 다시 로그인하면 동의 화면 없이 <strong className="text-foreground">완전히 새로운 계정</strong>이
            만들어집니다. 이 허가까지 없애려면 아래에서 직접 해제해 주세요.
          </p>
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-primary underline underline-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Google 계정 액세스 권한 관리
          </a>
        </div>

        <button
          type="button"
          onClick={() => nav('/', { replace: true })}
          className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
        >
          홈으로
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-5">
        <PageHeader title="계정 삭제" back />
        <div className="card-soft p-6 text-center">
          <p className="text-[13px] text-muted-foreground">
            로그인 상태가 아니에요. 삭제할 클라우드 계정이 없습니다.
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground">
            이 기기의 기록만 지우려면 <strong className="text-foreground">설정 → 데이터 관리 → 전체 삭제</strong>를
            사용하세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28">
      <PageHeader title="계정 삭제" back subtitle={user.email || undefined} />

      {/* 경고 */}
      <div className="card-danger space-y-2 p-4">
        <div className="flex items-center gap-2 text-[14px] font-bold text-destructive">
          <AlertTriangle className="h-4 w-4" />
          되돌릴 수 없습니다
        </div>
        <ul className="ml-4 list-disc space-y-1 text-[12px] leading-relaxed text-destructive/80">
          <li>클라우드에 백업된 실·도안·바늘·부자재·프로젝트가 모두 삭제됩니다.</li>
          <li>Google 계정 연결이 해제되고 이 서비스의 계정이 사라집니다.</li>
          <li>삭제 후에는 복구를 도와드릴 방법이 없습니다.</li>
        </ul>
      </div>

      {/* 백업 권유 */}
      <button
        type="button"
        onClick={() => nav('/settings/backup')}
        className="card-soft flex w-full items-center gap-3 border-primary/20 bg-primary/5 p-4 text-left transition active:scale-[0.99]"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Download className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-foreground">먼저 백업 파일을 저장하시겠어요?</div>
          <div className="text-[11.5px] text-muted-foreground">
            JSON 내보내기로 사진까지 보관한 뒤 삭제하는 것을 권해요
          </div>
        </div>
      </button>

      {/* 로컬 데이터 처리 선택 */}
      <label className="card-soft flex items-start gap-3 p-4">
        <input
          type="checkbox"
          checked={alsoClearLocal}
          onChange={e => setAlsoClearLocal(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-foreground">
            이 기기에 저장된 기록도 함께 삭제
          </span>
          <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
            체크를 해제하면 클라우드 계정만 지우고, 이 기기의 기록은 남겨 둡니다.
            사진은 원래 이 기기에만 있으므로 체크를 해제하면 사진이 보존됩니다.
          </span>
        </span>
      </label>

      {/* 확인 입력 */}
      <div className="card-soft space-y-2 p-4">
        <label className="block text-[12px] font-medium text-foreground">
          계속하려면 아래에 <strong className="text-destructive">{CONFIRM_WORD}</strong> 라고 입력해 주세요
        </label>
        <input
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder={CONFIRM_WORD}
          autoComplete="off"
          className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-destructive"
        />
      </div>

      {busy && progress && (
        <p className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {progress}
        </p>
      )}

      <button
        type="button"
        disabled={!canProceed}
        onClick={() => setConfirmOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-destructive py-3 text-sm font-semibold text-destructive-foreground disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
        계정과 데이터 영구 삭제
      </button>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        삭제가 잘 되지 않거나 도움이 필요하시면{' '}
        {OPERATOR_EMAIL ? (
          <a href={`mailto:${OPERATOR_EMAIL}`} className="text-primary underline underline-offset-2">
            {OPERATOR_EMAIL}
          </a>
        ) : (
          '문의 이메일'
        )}{' '}
        로 연락해 주세요.
      </p>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="정말 계정을 삭제할까요?"
        description={
          alsoClearLocal
            ? '클라우드 데이터와 계정, 그리고 이 기기의 모든 기록이 삭제됩니다. 되돌릴 수 없어요.'
            : '클라우드 데이터와 계정이 삭제됩니다. 이 기기의 기록은 남습니다. 되돌릴 수 없어요.'
        }
        confirmLabel="영구 삭제"
        cancelLabel="취소"
        destructive
        busy={busy}
        onConfirm={() => run(false)}
      />
    </div>
  );
}
