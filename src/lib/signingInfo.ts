import { Capacitor, registerPlugin } from '@capacitor/core';

// ----------------------------------------------------------------------------
// 앱 서명 지문 읽기 (안드로이드 전용, 진단용)
// ----------------------------------------------------------------------------
// Google 로그인이 DEVELOPER_ERROR(10) 로 실패할 때, Firebase / Play Console 에
// 등록된 지문과 "실제로 실행 중인 앱" 의 지문이 같은지 눈으로 대조하기 위한 것.
// 값은 화면에만 표시하고 자동으로 전송하지 않는다.

export interface SigningCertificate {
  sha1: string;
  sha256: string;
}

export interface SigningInfoResult {
  packageName: string;
  /** google-services.json 에서 앱에 박힌 OAuth 웹 클라이언트 ID */
  webClientId: string | null;
  certificates: SigningCertificate[];
}

const SigningInfo = registerPlugin<{
  getFingerprints(): Promise<SigningInfoResult>;
}>('SigningInfo');

/** 네이티브가 아니거나 플러그인이 없으면 null */
export async function readSigningInfo(): Promise<SigningInfoResult | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return await SigningInfo.getFingerprints();
  } catch (error) {
    console.warn('[signingInfo] 지문을 읽지 못했습니다:', error);
    return null;
  }
}
