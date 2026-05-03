export type KnittingAIResult = {
  projectName: string | null;
  part: string | null;
  rowsAdded: number | null;
  needleSize: string | null;
  note: string | null;
};

export async function askLocalAI(prompt: string): Promise<KnittingAIResult> {
  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      model: "llama3:8b",
      messages: [
        {
          role: "system",
          content:
            "너는 한국어 뜨개 기록 추출기다. 반드시 JSON만 출력한다. 문장에 나온 실제 한국어 단어를 그대로 복사한다. 모르는 값만 null로 둔다.",
        },
        {
          role: "user",
          content:
            "오늘 강아지 스웨터 소매 8단 떴고, 3.5mm 바늘 사용했어",
        },
        {
          role: "assistant",
          content:
            '{"projectName":"강아지 스웨터","part":"소매","rowsAdded":8,"needleSize":"3.5mm","note":"오늘 강아지 스웨터 소매 8단 진행, 3.5mm 바늘 사용"}',
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: false,
      format: "json",
      options: {
        temperature: 0,
      },
    }),
  });

  if (!res.ok) {
    throw new Error("Local AI request failed");
  }

  const data = await res.json();
  return JSON.parse(data.message.content) as KnittingAIResult;
}