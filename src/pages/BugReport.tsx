import { useEffect, useState } from 'react';
import { clearErrorLogs, getErrorLogs } from '@/lib/errorLog';
import { readSigningInfo, type SigningInfoResult } from '@/lib/signingInfo';
import { collectEnvInfo, APP_VERSION } from '@/lib/appVersion';
import { OPERATOR_EMAIL } from '@/lib/legalPlaceholders';
import PageHeader from '@/components/PageHeader';
import { toast } from '@/components/ui/sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { useAuth } from '@/hooks/useAuth';
import { submitBugReport, FEEDBACK_KIND_LABEL, type FeedbackKind } from '@/lib/bugReport';
import { Copy, Mail, Trash2, Send, Loader2, CheckCircle2, Bug, Lightbulb, MessageCircle } from 'lucide-react';

// ----------------------------------------------------------------------------
// 의견 보내기 — 버그 신고와 개선 제안을 한 화면에서 받는다
// ----------------------------------------------------------------------------
// 원칙: 사용자는 "무슨 일이 있었는지" 한 칸만 쓰면 된다.
//   - 오류 기록·기기 정보는 [보내기] 를 누를 때 자동으로 함께 간다.
//     (복사해서 붙여넣기를 시키면 아무도 안 한다)
//   - 기술적인 내용은 '고급' 안에 접어 둔다 — 카카오톡의 로그 수집 메뉴와 같은 결.
//   - 자동 수집은 하지 않는다. 반드시 사용자가 보내기를 눌러야 전송된다.

/** mailto 는 길면 잘리거나 열리지 않는 클라이언트가 있어 본문을 줄인다 */
const MAILTO_BODY_LIMIT = 1500;

const KINDS: { value: FeedbackKind; icon: typeof Bug; placeholder: string }[] = [
  {
    value: 'bug',
    icon: Bug,
    placeholder:
      "예: 프로젝트에서 '새 도안 추가'를 눌렀더니 화면이 하얗게 변했어요.\n어떤 화면에서 무엇을 눌렀을 때인지 적어주시면 큰 도움이 됩니다.",
  },
  {
    value: 'idea',
    icon: Lightbulb,
    placeholder:
      '예: 실 재고가 부족하면 미리 알려주면 좋겠어요.\n어떤 상황에서 아쉬웠는지 함께 적어주시면 좋아요.',
  },
  {
    value: 'etc',
    icon: MessageCircle,
    placeholder: '자유롭게 남겨주세요.',
  },
];

export default function BugReport() {
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [description, setDescription] = useState('');
  const [logs, setLogs] = useState(() => getErrorLogs());
  const { confirm, dialog } = useConfirm();
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [signing, setSigning] = useState<SigningInfoResult | null>(null);

  const env = collectEnvInfo();
  const active = KINDS.find(k => k.value === kind)!;

  useEffect(() => {
    readSigningInfo().then(setSigning);
  }, []);

  function reportText() {
    return JSON.stringify(
      { kind, description: description.trim(), ...env, signing, errorLogs: logs },
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
    if (ok) toast.success('내용을 복사했어요', { id: 'feedback' });
    else toast.error('복사하지 못했어요', { id: 'feedback', description: '아래 로그를 길게 눌러 직접 복사해 주세요.' });
  }

  /** 앱에서 바로 전송 — 로그인 사용자만 */
  async function handleSubmit() {
    if (sending) return;
    setSending(true);
    const res = await submitBugReport(description, kind);
    setSending(false);

    if (res.ok) {
      setSent(true);
      setDescription('');
      toast.success('보내주셔서 고맙습니다', {
        id: 'feedback',
        description: '확인하고 반영하겠습니다.',
      });
      return;
    }
    if (res.reason === 'empty') {
      toast.error('내용을 적어 주세요', { id: 'feedback' });
    } else if (res.reason === 'offline') {
      toast.error('오프라인 상태예요', { id: 'feedback', description: '인터넷 연결 후 다시 시도해 주세요.' });
    } else {
      toast.error('보내지 못했어요', { id: 'feedback', description: '아래 메일로 보내기를 이용해 주세요.' });
    }
  }

  async function handleSendEmail() {
    if (!OPERATOR_EMAIL) {
      toast.error('문의 이메일이 아직 설정되지 않았어요', { id: 'feedback' });
      return;
    }
    // 전문은 클립보드에, 메일 본문에는 요약만 — 너무 길면 메일 앱이 안 열린다
    const copiedOk = await copyToClipboard(reportText());

    const summary = [
      description.trim() || '(내용을 적어 주세요)',
      '',
      '--- 환경 정보 ---',
      `버전: v${env.appVersion}`,
      `페이지: ${env.pageUrl}`,
      `기기: ${env.userAgent}`,
      `오류 기록: ${logs.length}개`,
      '',
      copiedOk ? '※ 상세 내용이 클립보드에 복사되어 있어요. 여기에 붙여넣어 주세요.' : '',
    ]
      .join('\n')
      .slice(0, MAILTO_BODY_LIMIT);

    const url =
      `mailto:${OPERATOR_EMAIL}` +
      `?subject=${encodeURIComponent(`[뜨개일기 v${APP_VERSION}] ${FEEDBACK_KIND_LABEL[kind]}`)}` +
      `&body=${encodeURIComponent(summary)}`;

    window.location.href = url;
    toast.message('메일 앱을 열고 있어요', {
      id: 'feedback',
      description: copiedOk
        ? '열리지 않으면 복사된 내용을 메일로 보내주세요.'
        : `열리지 않으면 ${OPERATOR_EMAIL} 로 보내주세요.`,
      duration: 8000,
    });
  }

  async function handleClearLogs() {
    const ok = await confirm({
      title: '오류 기록을 비울까요?',
      description: '기록된 오류 내용이 사라져요. 의견을 먼저 보낸 뒤 비우는 걸 권해요.',
      confirmLabel: '비우기',
    });
    if (!ok) return;
    clearErrorLogs();
    setLogs([]);
    toast.success('오류 기록을 비웠어요', { id: 'feedback' });
  }

  return (
    <div className="space-y-5">
      <PageHeader title="의견 보내기" back />
      {dialog}

      {/* 어떤 이야기인지 먼저 고르게 한다 — 문구와 안내가 여기에 맞춰 바뀐다 */}
      <div className="grid grid-cols-3 gap-2">
        {KINDS.map(k => {
          const Icon = k.icon;
          const on = k.value === kind;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-[12px] font-semibold transition ${
                on
                  ? 'border-primary/40 bg-primary-soft text-primary'
                  : 'border-border bg-card text-muted-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {FEEDBACK_KIND_LABEL[k.value]}
            </button>
          );
        })}
      </div>

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder={active.placeholder}
        className="min-h-40 w-full rounded-2xl border bg-background p-4 text-sm leading-relaxed outline-none focus:border-primary"
      />

      {sent && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-3 text-[12.5px] text-primary">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          잘 받았어요. 확인하고 반영하겠습니다.
        </div>
      )}

      <div className="space-y-2">
        {user ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || !description.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? '보내는 중…' : '보내기'}
          </button>
        ) : (
          <>
            <p className="rounded-xl bg-secondary/60 px-3.5 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
              로그인하면 앱에서 바로 보낼 수 있어요. 지금은 메일로 보내주세요.
            </p>
            <button
              type="button"
              onClick={handleSendEmail}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground"
            >
              <Mail className="h-4 w-4" /> 메일로 보내기
            </button>
          </>
        )}

        {/* 오류 기록이 자동으로 함께 간다는 사실은 짧게, 그러나 분명히 알린다 */}
        {kind === 'bug' && (
          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            보내기를 누르면 <strong className="text-foreground">오류 기록 {logs.length}개</strong>와
            앱 버전·기기 정보가 자동으로 함께 전송돼요. 문제를 찾는 데만 씁니다.
            직접 복사해 붙여넣지 않으셔도 됩니다.
          </p>
        )}
      </div>

      {/* ── 고급 ────────────────────────────────────────────────
          기술적인 내용은 접어 둔다. 평소에는 볼 일이 없고,
          필요할 때만 열어 확인하거나 메일로 보낼 수 있게. */}
      <details className="card-soft p-4">
        <summary className="cursor-pointer text-[13px] font-bold text-foreground">고급</summary>

        <div className="mt-3 space-y-3">
          <div className="space-y-1 text-[11.5px]">
            <div className="text-muted-foreground">
              버전 <span className="tabular-nums text-foreground">v{env.appVersion}</span>
            </div>
            <div className="break-all text-muted-foreground">기기 {env.userAgent}</div>
            <div className="text-muted-foreground">
              오류 기록 <span className="tabular-nums text-foreground">{logs.length}개</span>
            </div>
          </div>

          {signing && (
            <div className="space-y-1 border-t border-border/60 pt-3 text-[11px]">
              <div className="text-muted-foreground">패키지</div>
              <div className="select-text break-all text-foreground">{signing.packageName}</div>
              {signing.certificates.map(cert => (
                <div key={cert.sha1}>
                  <div className="mt-1.5 text-muted-foreground">서명 SHA-1</div>
                  <div className="select-text break-all font-mono text-foreground">{cert.sha1}</div>
                </div>
              ))}
            </div>
          )}

          {logs.length > 0 && (
            <details className="border-t border-border/60 pt-3">
              <summary className="cursor-pointer text-[12px] font-semibold text-foreground">
                오류 기록 보기
              </summary>
              <pre className="mt-2 max-h-64 select-text overflow-auto rounded-lg bg-muted p-3 text-[11px]">
                {JSON.stringify(logs, null, 2)}
              </pre>
            </details>
          )}

          <div className="flex gap-2 border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={handleCopy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2.5 text-[12px] font-semibold text-foreground"
            >
              <Copy className="h-3.5 w-3.5" /> 내용 복사
            </button>
            {user && (
              <button
                type="button"
                onClick={handleSendEmail}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2.5 text-[12px] font-semibold text-foreground"
              >
                <Mail className="h-3.5 w-3.5" /> 메일로 보내기
              </button>
            )}
            {logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                className="flex items-center justify-center gap-1.5 rounded-full border px-3 py-2.5 text-[12px] font-semibold text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> 비우기
              </button>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
