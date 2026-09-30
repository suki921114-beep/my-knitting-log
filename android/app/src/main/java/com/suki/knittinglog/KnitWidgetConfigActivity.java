package com.suki.knittinglog;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 위젯을 홈 화면에 놓을 때 어느 프로젝트를 붙일지 고르는 화면.
 *
 * 이게 있어야 위젯을 여러 개 놓고 각각 다른 프로젝트를 볼 수 있다.
 * 없으면 전부 '가장 최근 것' 하나만 비춘다.
 *
 * 화면을 XML 없이 코드로 짠다. 고를 것이 목록 하나뿐이라 레이아웃 파일까지
 * 둘 이유가 없다.
 */
public class KnitWidgetConfigActivity extends Activity {

    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 취소하고 나가면 위젯이 안 놓이도록 먼저 실패로 답해 둔다.
        // 이걸 안 하면 고르다 뒤로 나갔을 때 빈 위젯이 홈에 남는다.
        setResult(RESULT_CANCELED);

        Intent intent = getIntent();
        if (intent != null && intent.getExtras() != null) {
            widgetId = intent.getExtras().getInt(
                    AppWidgetManager.EXTRA_APPWIDGET_ID,
                    AppWidgetManager.INVALID_APPWIDGET_ID);
        }
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        setContentView(buildView());
    }

    private View buildView() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#FBF9F5"));
        int pad = dp(20);
        root.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("어떤 프로젝트를 보시겠어요?");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        title.setTextColor(Color.parseColor("#3C3243"));
        root.addView(title);

        JSONArray projects = readProjects();
        if (projects == null || projects.length() == 0) {
            TextView empty = new TextView(this);
            empty.setText(
                    "진행중인 프로젝트가 없어요.\n\n"
                            + "앱을 열어 프로젝트를 '작업 중' 으로 두고\n"
                            + "한 번 나갔다 오시면 여기에 나옵니다.");
            empty.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            empty.setTextColor(Color.parseColor("#7C7288"));
            empty.setPadding(0, dp(16), 0, 0);
            root.addView(empty);
            return wrap(root);
        }

        for (int i = 0; i < projects.length(); i++) {
            JSONObject p = projects.optJSONObject(i);
            if (p == null) continue;
            final int projectId = p.optInt("id", -1);
            if (projectId < 0) continue;

            TextView row = new TextView(this);
            row.setText(p.optString("name", "프로젝트"));
            row.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
            row.setTextColor(Color.parseColor("#3C3243"));
            row.setPadding(dp(14), dp(14), dp(14), dp(14));
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setBackgroundColor(Color.parseColor("#F1ECF7"));

            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.topMargin = dp(8);
            row.setLayoutParams(lp);

            row.setOnClickListener(v -> choose(projectId));
            root.addView(row);
        }

        return wrap(root);
    }

    private ScrollView wrap(View child) {
        ScrollView scroll = new ScrollView(this);
        scroll.addView(child);
        return scroll;
    }

    private void choose(int projectId) {
        Context context = this;
        SharedPreferences prefs =
                context.getSharedPreferences(KnitWidgetPlugin.PREFS, Context.MODE_PRIVATE);
        prefs.edit().putInt(KnitCounterWidgetProvider.projectKey(widgetId), projectId).commit();

        // 어느 종류의 위젯에서 왔는지 보고 그것만 그린다
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] one = new int[] { widgetId };
        if (isPatternWidget(manager)) {
            KnitPatternWidgetProvider.renderAll(context, manager, one);
        } else {
            KnitCounterWidgetProvider.renderAll(context, manager, one);
        }

        Intent result = new Intent();
        result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        setResult(RESULT_OK, result);
        finish();
    }

    /** 도안 미리보기 위젯에서 열린 설정 화면인가 */
    private boolean isPatternWidget(AppWidgetManager manager) {
        try {
            android.appwidget.AppWidgetProviderInfo info = manager.getAppWidgetInfo(widgetId);
            return info != null
                    && info.provider != null
                    && info.provider.getClassName().contains("Pattern");
        } catch (Exception e) {
            return false;
        }
    }

    private JSONArray readProjects() {
        SharedPreferences prefs =
                getSharedPreferences(KnitWidgetPlugin.PREFS, Context.MODE_PRIVATE);
        String payload = prefs.getString(KnitWidgetPlugin.KEY_PAYLOAD, "");
        if (payload == null || payload.isEmpty()) return null;
        try {
            return new JSONObject(payload).optJSONArray("projects");
        } catch (Exception e) {
            return null;
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
