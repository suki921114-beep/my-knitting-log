import { useRef, useState } from 'react';
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
/** 숨은 문을 여는 데 필요한 두드림 횟수 */
const KNOCKS = 7;

export default function AppInfoDialog() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const knocks = useRef(0);
  const lastKnock = useRef(0);

  function go(path: string) {
    setOpen(false);
    nav(path);
  }

  /**
   * 버전 숫자를 연달아 두드리면 로그인 화면으로 간다.
   *
   * 클라우드 백업은 지금 명단에 있는 계정만 쓴다. 그래서 설정에서 로그인
   * 자리를 없앴는데, 그러면 새 기기에서 들어갈 길까지 막힌다. 앱에서는
   * 주소를 직접 칠 수도 없다.
   *
   * 눈에 안 띄면서 필요할 때 쓸 수 있는 문을 하나 남겨 둔다. 실수로 열리지
   * 않도록 연달아 눌러야만 열리게 했다 — 사이가 뜨면 처음부터 다시 센다.
   */
  function knock() {
    const now = Date.now();
    knocks.current = now - lastKnock.current > 1500 ? 1 : knocks.current + 1;
    lastKnock.current = now;
    if (knocks.current >= KNOCKS) {
      knocks.current = 0;
      go('/login');
    }
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
        {/* 숨은 문 — 여기를 연달아 두드리면 로그인으로 간다.
            바깥 버튼이 삼키지 않도록 눌림을 여기서 멈춘다. */}
        <span
          role="presentation"
          onClick={e => {
            e.stopPropagation();
            knock();
          }}
          className="text-[11.5px] tabular-nums text-muted-foreground"
        >
          ver. {APP_VERSION}
        </span>
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

          {/* 예전 문구는 두 군데가 틀렸다 — 사진도 함께 올라가고, 로그인만으로
              열리지도 않는다. 있는 그대로만 적는다. */}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            뜨개 기록은 이 기기에 저장됩니다. 설정 → 백업에서 파일로 내보내 두면
            기기를 바꿔도 그대로 옮길 수 있어요.
          </p>

          {OPERATOR_NAME && (
            <p className="text-[10.5px] text-muted-foreground/70">만든이 {OPERATOR_NAME}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
