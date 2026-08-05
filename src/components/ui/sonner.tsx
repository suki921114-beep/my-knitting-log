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
      offset="calc(var(--app-safe-top, 0px) + 16px)"
      // 여러 단계를 진행할 때 카드가 화면을 덮지 않도록 겹쳐 쌓고 개수를 제한한다
      expand={false}
      visibleToasts={3}
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
