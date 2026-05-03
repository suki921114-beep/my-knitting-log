// ----------------------------------------------------------------------------
// ConfirmDialog — shadcn AlertDialog 기반 파괴적 액션 확인 다이얼로그
// ----------------------------------------------------------------------------
// native window.confirm 은 모바일/PWA 에서:
//   - 시각적으로 OS 다이얼로그가 떠 앱 톤과 동떨어진다
//   - 인앱 브라우저 일부에서 차단/스킵되어 의도치 않은 즉시 실행 위험이 있다
//   - 텍스트가 두 줄 이상 들어가면 잘리거나 보기 흉하게 늘어진다
// 그래서 영구 삭제처럼 되돌릴 수 없는 액션은 이 컴포넌트로 감싼다.
//
// 사용 패턴:
//   const [open, setOpen] = useState(false);
//   const [pending, setPending] = useState<{label: string; onConfirm: () => void} | null>(null);
//   ...
//   <button onClick={() => { setPending({label, onConfirm: doDelete}); setOpen(true); }}>
//   <ConfirmDialog open={open} onOpenChange={setOpen} {...} />
//
// 또는 더 단순하게: useConfirmDialog() 훅으로 한 번에 묶을 수도 있음 (필요 시 추가).

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** 다이얼로그 제목 (예: "전체 데이터를 삭제할까요?") */
  title: string;
  /** 본문 설명 — 어떤 일이 일어나고 되돌릴 수 있는지/없는지 명확히 */
  description?: React.ReactNode;
  /** 확인 버튼 라벨. 기본 '확인' */
  confirmLabel?: string;
  /** 취소 버튼 라벨. 기본 '취소' */
  cancelLabel?: string;
  /** true 면 빨간 destructive 색으로 표시. 기본 true (이 컴포넌트 자체가 파괴적 액션용) */
  destructive?: boolean;
  /** 사용자가 확인을 눌렀을 때 호출. async 가능. */
  onConfirm: () => void | Promise<void>;
  /** 외부에서 진행 중 표시할 때 사용 (버튼 비활성화) */
  busy?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive = true,
  onConfirm,
  busy = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              // 기본 onClick 은 다이얼로그를 자동으로 닫는다. 비동기 작업은
              // 닫기 전에 확정되도록 await 한 후 onOpenChange 가 닫게 둔다.
              e.preventDefault();
              try {
                await onConfirm();
              } finally {
                onOpenChange(false);
              }
            }}
            className={
              destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
