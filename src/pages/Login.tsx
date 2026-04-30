import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import PageHeader from "@/components/PageHeader";

export default function Login() {
  const { signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 이미 로그인되어 있다면 홈으로 이동시킵니다.
  useEffect(() => {
    if (user) {
      navigate(-1); // 이전 페이지로 돌아가기 (또는 '/' 홈으로 이동)
    }
  }, [user, navigate]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
      // 로그인이 완료되면 user 상태가 바뀌어 useEffect에 의해 자동으로 이동합니다.
    } catch (error) {
      alert("로그인에 실패했습니다. 다시 시도해 주세요.");
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="로그인" showBack />

      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <LogIn className="h-8 w-8" />
        </div>
        
        <h2 className="mb-3 text-[20px] font-bold text-foreground">
          동기화를 위해 로그인하세요
        </h2>
        <p className="mb-10 text-[13.5px] leading-relaxed text-muted-foreground max-w-[260px]">
          계정을 연결하면 여러 기기에서 나의 뜨개 기록을 안전하게 관리하고 동기화할 수 있어요.
        </p>

        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="flex w-full max-w-sm items-center justify-center gap-3 rounded-2xl bg-foreground px-4 py-3.5 text-[14px] font-semibold text-background transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
        >
          {isLoggingIn ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              로그인 중...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google로 시작하기
            </>
          )}
        </button>
      </div>
    </div>
  );
}
