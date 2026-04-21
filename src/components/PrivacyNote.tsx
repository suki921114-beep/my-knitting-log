import { ShieldCheck } from 'lucide-react';

export default function PrivacyNote({ kind = 'default' }: { kind?: 'default' | 'memo' }) {
  const text =
    kind === 'memo'
      ? '메모와 사진에 이름·연락처·주소·얼굴 등 개인정보가 포함되지 않도록 주의해 주세요.'
      : '이 앱은 이메일·전화번호 등 직접 식별정보를 요구하지 않습니다. 데이터는 이 기기에만 저장돼요.';
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-cream/60 p-3 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
      <p className="leading-relaxed">{text}</p>
    </div>
  );
}
