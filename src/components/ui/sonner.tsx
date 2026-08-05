import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // 하단은 탭바와 제스처 바에 가려 메시지가 잘린다. 위쪽에 띄우되
      // 상태표시줄(노치) 아래로 충분히 내려 잘리지 않게 한다.
      position="top-center"
      // 상태표시줄(노치) 아래로 넉넉히 — 붙어 있으면 답답하고 잘려 보인다.
      // ⚠️ sonner 는 좁은 화면에서 offset 대신 mobileOffset 을 쓴다.
      //    둘 다 주지 않으면 폰에서는 전혀 반영되지 않는다.
      // ⚠️ 값을 하나만 주면 위아래좌우 전부에 적용된다. 그러면 sonner 가
      //    좁은 화면에서 폭을 `100% - 좌우여백*2` 로 계산하므로 카드가 확 좁아진다.
      //    위쪽만 크게 두고 좌우는 따로 지정한다.
      offset={{ top: 'calc(var(--app-safe-top, 0px) + 28px)' }}
      mobileOffset={{
        top: 'calc(var(--app-safe-top, 0px) + 28px)',
        left: '14px',
        right: '14px',
      }}
      // 한 번에 하나만. 여러 장이 겹쳐 보이면 카드가 여러 개 뜬 것처럼 읽힌다.
      expand={false}
      visibleToasts={1}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
