import { useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

// ----------------------------------------------------------------------------
// useConfirm — window.confirm 을 대체하는 Promise 기반 확인 다이얼로그
// ----------------------------------------------------------------------------
// window.confirm 은 Capacitor WebView / 인앱 브라우저에서 차단되거나 무시될 수
// 있다. 차단되면 confirm 이 즉시 false 를 반환해 "삭제가 안 되는" 정도로
// 끝나지만, 반대로 일부 환경에서는 true 로 통과해 확인 없이 삭제가 실행된다.
// 어느 쪽이든 위험해서 앱 내부 다이얼로그로 통일한다.
//
// 사용법:
//   const { confirm, dialog } = useConfirm();
//   ...
//   if (!(await confirm({ title: '삭제할까요?', description: '...' }))) return;
//   ...
//   return <>{dialog}...</>;

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  const dialog = opts ? (
    <ConfirmDialog
      open={open}
      onOpenChange={next => {
        setOpen(next);
        // 바깥 클릭 / 취소 / ESC 로 닫히면 false 로 확정
        if (!next) settle(false);
      }}
      title={opts.title}
      description={opts.description}
      confirmLabel={opts.confirmLabel}
      cancelLabel={opts.cancelLabel}
      destructive={opts.destructive ?? true}
      onConfirm={() => settle(true)}
    />
  ) : null;

  return { confirm, dialog };
}
