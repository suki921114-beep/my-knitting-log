import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearErrorLogs, getErrorLogs } from "@/lib/errorLog";
import PageHeader from "@/components/PageHeader";

export default function BugReport() {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState(() => getErrorLogs());

  const report = {
    description,
    pageUrl: window.location.href,
    userAgent: navigator.userAgent,
    createdAt: new Date().toISOString(),
    errorLogs: logs,
  };

  async function handleCopy() {
    setCopied(false);

    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));

    setCopied(true);
  }

  function handleClearLogs() {
    clearErrorLogs();
    setLogs([]);
  }

  return ( 
     <div className="space-y-5">
        <PageHeader title="버그 신고" back />

            

      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        앱에서 문제가 생긴 상황을 적어 주세요. 개인정보, 비밀번호, 민감한
        내용은 적지 마세요.
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="어떤 화면에서 어떤 문제가 있었는지 적어 주세요."
        className="min-h-40 w-full rounded-xl border bg-background p-4 text-sm"
      />

      <div className="space-y-2 rounded-xl border bg-card p-4 text-sm">
        <div className="font-bold">기본 정보</div>
        <div>현재 페이지: {window.location.href}</div>
        <div className="break-all">브라우저: {navigator.userAgent}</div>
        <div>최근 에러 로그: {logs.length}개</div>
      </div>

      <div className="space-y-2 rounded-xl border bg-card p-4">
        <div className="font-bold">최근 에러 로그</div>

        {logs.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            저장된 에러 로그가 없습니다.
          </div>
        ) : (
          <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
            {JSON.stringify(logs, null, 2)}
          </pre>
        )}
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
      >
        신고 내용 복사
      </button>

      <button
        type="button"
        onClick={handleClearLogs}
        className="w-full rounded-xl border px-4 py-3 text-sm"
      >
        에러 로그 비우기
      </button>

      {copied && (
        <div className="rounded-xl border bg-card p-4 text-sm">
          신고 내용이 클립보드에 복사되었습니다.
        </div>
      )}
    </div>
  );
}