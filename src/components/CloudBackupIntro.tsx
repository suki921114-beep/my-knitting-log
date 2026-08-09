// ----------------------------------------------------------------------------
// 클라우드 백업 안내
// ----------------------------------------------------------------------------
// 아직 쓸 수 없는 사람에게 보이는 자리.
//
// 그냥 감추면 "로그인했는데 아무것도 없다" 가 되어 고장으로 읽힌다.
// 그렇다고 못 쓰는 기능을 길게 늘어놓으면 화면만 답답해진다.
// 그래서 한 줄만 내놓고, 궁금하면 눌러서 보게 한다 (카카오톡 톡클라우드 방식).
//
// 값이나 신청 절차는 여기서 말하지 않는다. 아직 정해진 것이 없고,
// 정해지지 않은 것을 적어 두면 나중에 말을 바꾸게 된다.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CloudUpload, ChevronRight, Check } from 'lucide-react';
import { PRO_CONTACT_PATH } from '@/lib/entitlement';

const POINTS = [
  '기록과 사진이 클라우드에 함께 보관돼요',
  '기기를 바꾸거나 앱을 지워도 그대로 복원돼요',
  '폰과 태블릿에서 같은 기록을 볼 수 있어요',
];

export default function CloudBackupIntro() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card-soft flex w-full items-center gap-3 p-4 text-left transition active:scale-[0.99] hover:shadow-soft"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <CloudUpload className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-foreground">클라우드 백업</span>
          <span className="block text-[11.5px] text-muted-foreground">
            기기를 바꿔도 기록과 사진이 남아요
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-[15px] font-bold">클라우드 백업</DialogTitle>

          <ul className="mt-1 space-y-2.5">
            {POINTS.map(p => (
              <li key={p} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-[12.5px] leading-relaxed text-ink">{p}</span>
              </li>
            ))}
          </ul>

          <p className="mt-1 border-t border-border/60 pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
            지금은 준비 중이에요. 그동안에는 <strong className="text-foreground">파일로 내보내기</strong>로
            사진까지 통째로 보관할 수 있어요.
          </p>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              nav(PRO_CONTACT_PATH);
            }}
            className="mt-1 w-full rounded-xl bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground transition active:scale-[0.98]"
          >
            알아보기
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
