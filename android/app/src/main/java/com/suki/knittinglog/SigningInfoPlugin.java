package com.suki.knittinglog;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.MessageDigest;

/**
 * 진단용 플러그인.
 *
 * Google 로그인이 DEVELOPER_ERROR(10) 로 실패할 때, "지금 실행 중인 이 앱" 이
 * 실제로 어떤 인증서로 서명되어 있고 어떤 웹 클라이언트 ID 를 쓰는지 알려 준다.
 * Firebase / Play Console 에 등록된 값과 눈으로 대조하기 위한 것으로,
 * 어떤 값도 밖으로 보내지 않는다.
 */
@CapacitorPlugin(name = "SigningInfo")
public class SigningInfoPlugin extends Plugin {

    @PluginMethod
    public void getFingerprints(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            String pkg = getContext().getPackageName();

            Signature[] signatures;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo info = pm.getPackageInfo(pkg, PackageManager.GET_SIGNING_CERTIFICATES);
                android.content.pm.SigningInfo si = info.signingInfo;
                signatures = si.hasMultipleSigners() ? si.getApkContentsSigners() : si.getSigningCertificateHistory();
            } else {
                @SuppressWarnings("deprecation")
                PackageInfo info = pm.getPackageInfo(pkg, PackageManager.GET_SIGNATURES);
                signatures = info.signatures;
            }

            JSArray certificates = new JSArray();
            for (Signature signature : signatures) {
                JSObject cert = new JSObject();
                cert.put("sha1", digest(signature.toByteArray(), "SHA-1"));
                cert.put("sha256", digest(signature.toByteArray(), "SHA-256"));
                certificates.put(cert);
            }

            // google-services 플러그인이 google-services.json 에서 만들어 넣는 값.
            // 앱이 실제로 어떤 OAuth 웹 클라이언트를 쓰는지 여기서 확인할 수 있다.
            int resId = getContext().getResources().getIdentifier("default_web_client_id", "string", pkg);

            JSObject result = new JSObject();
            result.put("packageName", pkg);
            result.put("webClientId", resId != 0 ? getContext().getString(resId) : null);
            result.put("certificates", certificates);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject(String.valueOf(exception.getMessage()), exception);
        }
    }

    /** 바이트 배열을 AA:BB:CC 형태의 지문 문자열로 */
    private static String digest(byte[] data, String algorithm) throws Exception {
        byte[] hash = MessageDigest.getInstance(algorithm).digest(data);
        StringBuilder sb = new StringBuilder(hash.length * 3);
        for (byte b : hash) {
            if (sb.length() > 0) sb.append(':');
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }
}
