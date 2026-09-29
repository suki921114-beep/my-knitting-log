package com.suki.knittinglog;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 로그인 문제 진단용. 설정 → 버그 신고에서 이 앱의 서명 지문을 보여 준다.
        registerPlugin(SigningInfoPlugin.class);
        // 홈 화면 위젯에 요약본을 넘기는 통로
        registerPlugin(KnitWidgetPlugin.class);
        super.onCreate(savedInstanceState);

        // 위젯을 눌러서 들어온 경우 — 어디로 가야 하는지 적어 둔다.
        // 화면이 아직 안 그려졌을 수 있어 여기서 바로 보내지 않고, 웹 쪽이
        // 준비되면 KnitWidgetPlugin.consumeTarget() 으로 가져간다.
        KnitWidgetPlugin.rememberTarget(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // 앱이 이미 떠 있는 상태에서 위젯을 누른 경우.
        // 이때는 웹이 살아 있으므로 바로 알린다.
        KnitWidgetPlugin.rememberTarget(intent);
        KnitWidgetPlugin.notifyTarget();
    }
}
