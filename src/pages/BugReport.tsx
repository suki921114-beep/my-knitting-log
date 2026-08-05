import { useEffect, useState } from 'react';
import { clearErrorLogs, getErrorLogs } from '@/lib/errorLog';
import { readSigningInfo, type SigningInfoResult } from '@/lib/signingInfo';
import { collectEnvInfo, APP_VERSION } from '@/lib/appVersion';
import { OPERATOR_EMAIL } from '@/lib/legalPlaceholders';
import PageHeader from '@/components/PageHeader';
import { toast } from '@/components/ui/sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { useAuth } from '@/hooks/useAuth';
import { submitBugReport } from '@/lib/bugReport';
import { Copy, Mail, Trash2, Bug, Send, Loader2, CheckCircle2 } from 'lucide-react';

/** mailto 는 길면 잘리거나 열리지 않는 클라이언트가 있어 본문을 줄인다 */
const MAILTO_BODY_LIMIT = 1500;

export default function BugReport() {
  const [description, setDescription] = useState('');
  const [logs, setLogs] = useState(() => getErrorLogs());
  const [copied, setCopied] = useState(false);
  const { confirm, dialog } = useConfirm();
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [signing, setSigning] = useState<SigningInfoResult | null>(null);

  const env = collectEnvInfo();

  useEffect(() => {
    readSigningInfo().then(setSigning);
  }, []);

  function reportText() {
    return JSON.stringify(
      { description: description.trim(), ...env, signing, errorLogs: logs },
      null,
      2,
    );
  }

  /**
   * navigator.clipboard 는 비보안 컨텍스트나 일부 WebView 에서 없거나 실패한다.
   * 실패하면 textarea + execCommand 로 폴백한다.
   */
  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // 폴백으로 진행
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function handleCopy() {
    const ok = await copyToClipboard(reportText());
    setCopied(ok);
    if (ok) {
      toast.success('신고 내용을 복사했어요');
    } else {
      toast.error('복사하지 못했어요', {
        description: '아래 로그를 길게 눌러 직접 복사해 주세요.',
      });
    }
  }

  /** 앱에서 바로 전송 — 로그인 사용자만 */
  async function handleSubmit() {
    if (sending) return;
    setSending(true);
    const res = await submitBugReport(description);
    setSending(false);

    if (res.ok) {
      setSent(true);
      setDescription('');
      toast.success('신고를 보냈어요', { description: '확인하고 고치겠습니다. 고맙습니다!' });
      return;
    }
    if (res.reason === 'empty') {
      toast.error('어떤 문제가 있었는지 적어 주세요');
    } else if (res.reason === 'offline') {
      toast.error('오프라인 상태예요', { description: '인터넷 연결 후 다시 시도해 주세요.' });
    } else {
      toast.error('전송하지 못했어요', { description: '아래 메일 보내기를 이용해 주세요.' });
    }
  }

  async function handleSendEmail() {
    if (!OPERATOR_EMAIL) {
      toast.error('문의 이메일이 아직 설정되지 않았어요');
      return;
    }
    // 전문은 클립보드에, 메일 본문에는 요약만 — 너무 길면 메일 앱이 안 열린다
    const copiedOk = await copyToClipboard(reportText());

    const summary = [
      description.trim() || '(증상을 적어 주세요)',
      '',
      '--- 환경 정보 ---',
      `버전: v${env.appVersion}`,
      `페이지: ${env.pageUrl}`,
      `기기: ${env.userAgent}`,
      `에러 로그: ${logs.length}개`,
      '',
      copiedOk ? '※ 로그 전문이 클립보드에 복사되어 있어요. 여기에 붙여넣어 주세요.' : '',
    ]
      .join('\n')
      .slice(0, MAILTO_BODY_LIMIT);

    const url =
      `mailto:${OPERATOR_EMAIL}` +
      `?subject=${encodeURIComponent(`[뜨개일기 v${APP_VERSION}] 버그 신고`)}` +
      `&body=${encodeURIComponent(summary)}`;

    // 메일 앱이 없으면 아무 일도 일어나지 않으므로 안내를 함께 띄운다
    window.location.href = url;
    toast.message('메일 앱을 열고 있어요', {
      description: copiedOk
        ? '열리지 않으면 복사된 내용을 메일로 보내주세요.'
        : `열리지 않으면 ${OPERATOR_EMAIL} 로 보내주세요.`,
      duration: 8000,
    });
  }

  async function handleClearLogs() {
    const ok = await confirm({
      title: '에러 로그를 비울까요?',
      description: '기록된 오류 내용이 사라져요. 신고를 먼저 보낸 뒤 비우는 걸 권해요.',
      confirmLabel: '비우기',
    });
    if (!ok) return;
    clearErrorLogs();
    setLogs([]);
    toast.success('에러 로그를 비웠어요');
  }

  return (
    <div className="space-y-5">
      <PageHeader title="버그 신고" back />
      {dialog}

      <div className="card-soft flex items-start gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Bug className="h-4 w-4" />
        </span>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          어떤 화면에서 무엇을 눌렀을 때 문제가 생겼는지 적어 주시면 원인을 찾는 데 큰 도움이 됩니다.
          보내기를 누르면 아래 정보가 함께 전송돼요. 개인정보나 비밀번호는 적지 마세요.
        </p>
      </div>

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="예: 프로젝트에서 '새 도안 추가'를 눌렀더니 화면이 하얗게 변했어요."
        className="min-h-36 w-full rounded-xl border bg-background p-4 text-sm outline-none focus:border-primary"
      />

      <div className="card-soft space-y-1 p-4 text-[12px]">
        <div className="mb-1 text-[13px] font-bold text-foreground">함께 보내지는 정보</div>
        <div className="text-muted-foreground">
          버전 <span className="tabular-nums text-foreground">v{env.appVersion}</span>
        </div>
        <div className="break-all text-muted-foreground">페이지 {env.pageUrl}</div>
        <div className="break-all text-muted-foreground">기기 {env.userAgent}</div>
        <div className="text-muted-foreground">
          최근 에러 로그 <span className="tabular-nums text-foreground">{logs.length}개</span>
        </div>
      </div>

      {signing && (
        <details className="card-soft p-4">
          <summary className="cursor-pointer text-[13px] font-bold text-foreground">
            앱 서명 정보 (로그인 문제 진단용)
          </summary>
          <div className="mt-2 space-y-2 text-[11px]">
            <div>
              <div className="text-muted-foreground">패키지</div>
              <div className="select-text break-all text-foreground">{signing.packageName}</div>
            </div>
            <div>
              <div className="text-muted-foreground">웹 클라이언트 ID</div>
              <div className="select-text break-all text-foreground">
                {signing.webClientId ?? '(없음)'}
              </div>
            </div>
            {signing.certificates.map((cert, i) => (
              <div key={cert.sha1}>
                <div className="text-muted-foreground">
                  서명 인증서 SHA-1 {signing.certificates.length > 1 ? `#${i + 1}` : ''}
                </div>
                <div className="select-text break-all font-mono text-foreground">{cert.sha1}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      {logs.length > 0 && (
        <details className="card-soft p-4">
          <summary className="cursor-pointer text-[13px] font-bold text-foreground">
            최근 에러 로그 보기
          </summary>
          <pre className="mt-2 max-h-64 select-text overflow-auto rounded-lg bg-muted p-3 text-[11px]">
            {JSON.stringify(logs, null, 2)}
          </pre>
        </details>
      )}

      {sent && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-3 text-[12.5px] text-primary">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          신고가 접수되었어요. 확인하고 고치겠습니다.
        </div>
      )}

      <div className="space-y-2">
        {user ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || !description.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? '보내는 중…' : '신고 보내기'}
          </button>
        ) : (
          <p className="rounded-xl bg-secondary/60 px-3.5 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
            로그인하면 앱에서 바로 신고를 보낼 수 있어요. 지금은 아래 메일 보내기를 이용해 주세요.
          </p>
        )}

        <button
          type="button"
          onClick={handleSendEmail}
          className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold ${
            user
              ? 'border border-primary/40 bg-primary/5 text-primary'
              : 'bg-primary text-primary-foreground'
          }`}
        >
          <Mail className="h-4 w-4" />
          메일로 보내기
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm text-muted-foreground"
        >
          <Copy className="h-4 w-4" />
          신고 내용 복사
        </button>
        <button
          type="button"
          onClick={handleClearLogs}
          className="flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm text-muted-foreground"
        >
          <Trash2 className="h-4 w-4" />
          에러 로그 비우기
        </button>
      </div>

      {copied && (
        <p className="text-center text-[12px] text-muted-foreground">
          신고 내용이 클립보드에 복사되었습니다.
        </p>
      )}
    </div>
  );
}
