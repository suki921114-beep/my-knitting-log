import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { APP_VERSION } from '@/lib/appVersion';
import { OPERATOR_NAME } from '@/lib/legalPlaceholders';
import { Info } from 'lucide-react';

const APP_NAME = '뜨개일기';

/**
 * 설정 맨 아래의 "ⓘ 뜨개일기 정보" 행.
 * 누르면 버전과 함께 개인정보처리방침 / 이용약관 / 앱 정보 링크를 보여 준다.
 * (카카오톡 설정의 앱 정보 패턴)
 */
export default function AppInfoDialog() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  function go(path: string) {
    setOpen(false);
    nav(path);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-[13px] text-foreground">{APP_NAME} 정보</span>
        </span>
        <span className="text-[11.5px] tabular-nums text-muted-foreground">ver. {APP_VERSION}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="sr-only">{APP_NAME} 정보</DialogTitle>

          <div className="flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt=""
              className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-sm"
            />
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-foreground">{APP_NAME}</div>
              <div className="text-[12px] tabular-nums text-muted-foreground">ver. {APP_VERSION}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/60 pt-3 text-[12.5px]">
            <button
              type="button"
              onClick={() => go('/privacy')}
              className="font-semibold text-foreground hover:underline"
            >
              개인정보처리방침
            </button>
            <span className="text-border">|</span>
            <button
              type="button"
              onClick={() => go('/terms')}
              className="text-muted-foreground hover:underline"
            >
              이용약관
            </button>
            <span className="text-border">|</span>
            <button
              type="button"
              onClick={() => go('/about')}
              className="text-muted-foreground hover:underline"
            >
              앱 정보 · 오픈소스
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            뜨개 기록은 기본적으로 이 기기에 저장됩니다. 로그인하면 사진을 제외한 기록을
            클라우드에 백업할 수 있어요.
          </p>

          {OPERATOR_NAME && (
            <p className="text-[10.5px] text-muted-foreground/70">만든이 {OPERATOR_NAME}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
