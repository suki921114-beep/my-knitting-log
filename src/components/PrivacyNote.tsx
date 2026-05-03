import { ShieldCheck } from 'lucide-react';

export default function PrivacyNote({ kind = 'default' }: { kind?: 'default' | 'memo' }) {
  const text =
    kind === 'memo'
      ? '메모·사진에 개인정보가 포함되지 않도록 주의해주세요.'
      : '데이터는 이 기기에만 저장됩니다.';
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-3.5 py-2.5 text-[12px] text-muted-foreground">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
      <p>{text}</p>
    </div>
  );
}
