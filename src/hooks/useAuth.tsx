import { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { auth, googleProvider } from "@/lib/firebase";
import { captureError } from "@/lib/errorLog";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  logout: async () => {},
});

/** 로그인 오류에서 사람이 읽을 수 있는 원인을 뽑아낸다 */
export function describeAuthError(error: unknown): string {
  const e = error as { code?: string | number; message?: string; errorMessage?: string } | null;
  const code = e?.code ?? (e as any)?.errorCode;
  const msg = e?.message ?? e?.errorMessage ?? String(error);

  const hints: Record<string, string> = {
    "10": "DEVELOPER_ERROR — 이 앱 서명의 SHA-1 이 Firebase 에 등록되어 있지 않거나 google-services.json 이 오래되었습니다.",
    "12500": "Play 서비스 설정 오류 — SHA-1 또는 OAuth 클라이언트 설정을 확인하세요.",
    "12501": "사용자가 로그인을 취소했습니다.",
    "7": "네트워크 오류입니다.",
  };

  // Credential Manager 계열 오류는 code 대신 메시지로만 온다
  if (/no credentials available/i.test(msg)) {
    return "Google 로그인 실패 | 기기에서 사용할 수 있는 Google 계정을 찾지 못했습니다. 폰 설정 → 계정에 Google 계정이 추가되어 있는지 확인해 주세요.";
  }
  if (/canceled|cancelled/i.test(msg)) {
    return "Google 로그인을 취소했습니다.";
  }
  const hint = code != null ? hints[String(code)] : undefined;

  return [
    `Google 로그인 실패`,
    code != null ? `code=${code}` : null,
    hint,
    msg,
  ]
    .filter(Boolean)
    .join(" | ");
}

/**
 * 안드로이드 Google 로그인.
 *
 * 플러그인 8.x 는 기본으로 Credential Manager 를 쓰는데, 기기에 저장된
 * 자격증명을 못 찾으면 "No credentials available" 로 실패한다.
 * 계정이 분명히 있는데도 나는 경우가 있어(Play 서비스 상태, 기업 정책,
 * 일부 제조사 ROM 등) 실패하면 예전 GoogleSignIn 인텐트 방식으로 재시도한다.
 */
async function signInWithGoogleNative() {
  try {
    return await FirebaseAuthentication.signInWithGoogle();
  } catch (error) {
    const msg = String((error as { message?: string })?.message ?? error);
    console.warn("[auth] Credential Manager 실패 — 예전 방식으로 재시도:", msg);
    captureError(
      `Credential Manager 실패, 폴백 시도 | ${msg}`,
      "signInWithGoogle/credentialManager",
    );
    // useCredentialManager: false → GoogleSignIn 인텐트(계정 선택 화면)로 진행
    return await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await signInWithGoogleNative();

        const idToken = result.credential?.idToken;
        const accessToken = result.credential?.accessToken;

        if (!idToken && !accessToken) {
          throw new Error("Google 로그인 토큰을 가져오지 못했습니다.");
        }

        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        await signInWithCredential(auth, credential);

        return;
      }

      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google 로그인 중 에러 발생:", error);
      // 원인 코드를 남겨 둔다. 설정 → 버그 신고에서 확인할 수 있고,
      // 신고를 보내면 그대로 전송된다.
      // 흔한 코드: 10/DEVELOPER_ERROR = SHA-1 미등록, 12500 = Play 서비스 설정,
      //           12501 = 사용자가 취소, 7 = 네트워크
      captureError(describeAuthError(error), "signInWithGoogle");
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signOut();
      }

      await signOut(auth);
    } catch (error) {
      console.error("로그아웃 중 에러 발생:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}