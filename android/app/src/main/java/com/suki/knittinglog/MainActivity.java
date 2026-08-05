package com.suki.knittinglog;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 로그인 문제 진단용. 설정 → 버그 신고에서 이 앱의 서명 지문을 보여 준다.
        registerPlugin(SigningInfoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
