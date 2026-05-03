import { useState } from "react";
import { askLocalAI, type KnittingAIResult } from "@/lib/ai/askLocalAI";
//import { PageHeader } from "@/components/PageHeader";

export default function AiLog() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<KnittingAIResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAnalyze() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await askLocalAI(text);
      setResult(data);
    } catch {
      setError("로컬 AI 서버(Ollama)가 실행 중인지 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
  <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
  AI 기록 입력
</h1>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="오늘 봄이 조끼 등판 15단 떴고, 4.5mm 바늘 사용했어"
        className="min-h-32 w-full rounded-xl border bg-background p-4 text-sm"
      />

      <button
        type="button"
        onClick={handleAnalyze}
        disabled={loading || !text.trim()}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {loading ? "분석 중..." : "AI로 분석"}
      </button>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-lg font-bold">분석 결과</h2>

          <div className="text-sm">프로젝트: {result.projectName ?? "-"}</div>
          <div className="text-sm">부위: {result.part ?? "-"}</div>
          <div className="text-sm">추가 단수: {result.rowsAdded ?? "-"}</div>
          <div className="text-sm">바늘: {result.needleSize ?? "-"}</div>
          <div className="text-sm">메모: {result.note ?? "-"}</div>

          <button
            type="button"
            disabled
            className="w-full rounded-xl border px-4 py-3 text-sm opacity-50"
          >
            저장은 다음 단계에서 지원 예정
          </button>

          <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
