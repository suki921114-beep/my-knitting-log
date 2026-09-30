package com.suki.knittinglog;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 단수 카운터 위젯 — 지금 뜨고 있는 것과 단수를 보여 주고, 홈 화면에서 바로 센다.
 *
 * ⚠️ 위젯은 '지금 몇 단' 을 들지 않는다. '앱이 알려준 값' 과 '그 뒤로 몇 번
 *    눌렸는지' 를 따로 들고, 보여줄 때만 더한다.
 *
 *    위젯이 단수의 주인이 되면 앱에서 직접 고친 값과 부딪히고, 어느 쪽이 맞는지
 *    정할 방법이 없다. 단수는 한번 어긋나면 실물을 세어야 돌아온다.
 *    눌린 횟수만 들면 어느 쪽을 만져도 더해지므로 어긋나지 않는다.
 */
public class KnitCounterWidgetProvider extends AppWidgetProvider {

    /** MainActivity 가 읽어 갈 목적지 */
    public static final String EXTRA_PROJECT_ID = "knit.projectId";

    static final String ACTION_BUMP = "com.suki.knittinglog.BUMP";
    static final String EXTRA_COUNTER_ID = "knit.counterId";
    static final String EXTRA_DELTA = "knit.delta";
    static final String EXTRA_WIDGET_ID = "knit.widgetId";

    /** 위젯 번호별로 어떤 프로젝트를 보는지 */
    static String projectKey(int widgetId) {
        return "widget_" + widgetId + "_project";
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        renderAll(context, manager, ids);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        // 홈에서 뗀 위젯의 설정까지 같이 지운다. 안 그러면 계속 쌓인다.
        SharedPreferences prefs =
                context.getSharedPreferences(KnitWidgetPlugin.PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        for (int id : ids) editor.remove(projectKey(id));
        editor.apply();
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent == null || !ACTION_BUMP.equals(intent.getAction())) return;

        int counterId = intent.getIntExtra(EXTRA_COUNTER_ID, -1);
        int delta = intent.getIntExtra(EXTRA_DELTA, 0);
        int widgetId = intent.getIntExtra(EXTRA_WIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (counterId < 0 || delta == 0) return;

        SharedPreferences prefs =
                context.getSharedPreferences(KnitWidgetPlugin.PREFS, Context.MODE_PRIVATE);
        String key = KnitWidgetPlugin.PENDING_PREFIX + counterId;
        int next = prefs.getInt(key, 0) + delta;
        prefs.edit().putInt(key, next).commit();

        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            manager.updateAppWidget(widgetId, build(context, widgetId));
        }
    }

    static void renderAll(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, build(context, id));
        }
    }

    private static RemoteViews build(Context context, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.knit_widget_counter);

        SharedPreferences prefs =
                context.getSharedPreferences(KnitWidgetPlugin.PREFS, Context.MODE_PRIVATE);
        int wanted = prefs.getInt(projectKey(widgetId), -1);
        String payload = prefs.getString(KnitWidgetPlugin.KEY_PAYLOAD, "");

        JSONObject project = WidgetData.pick(payload, wanted);
        int projectId = project == null ? wanted : project.optInt("id", wanted);

        views.setOnClickPendingIntent(
                R.id.widget_body, WidgetData.openIntent(context, widgetId, projectId));

        if (project == null) {
            views.setTextViewText(R.id.widget_title, "뜨개일기");
            views.setTextViewText(R.id.widget_count, "—");
            views.setTextViewText(
                    R.id.widget_caption,
                    wanted > 0 ? "작업 중인 프로젝트가 아니에요" : "진행중인 프로젝트가 없어요");
            views.setViewVisibility(R.id.widget_photo, View.GONE);
            views.setViewVisibility(R.id.widget_minus, View.GONE);
            views.setViewVisibility(R.id.widget_plus, View.GONE);
            return views;
        }

        views.setTextViewText(R.id.widget_title, project.optString("name", "프로젝트"));

        JSONArray counters = project.optJSONArray("counters");
        JSONObject c = counters == null ? null : counters.optJSONObject(0);
        if (c != null) {
            int counterId = c.optInt("id", -1);
            int pending = counterId < 0
                    ? 0
                    : prefs.getInt(KnitWidgetPlugin.PENDING_PREFIX + counterId, 0);
            // 앱이 알려준 값 + 그 뒤로 눌린 만큼. 단수가 음수가 될 수는 없다.
            int shown = Math.max(0, c.optInt("count", 0) + pending);
            int goal = c.optInt("goal", 0);
            String name = c.optString("name", "");

            views.setTextViewText(R.id.widget_count, String.valueOf(shown));
            views.setTextViewText(
                    R.id.widget_caption,
                    goal > 0 ? name + " · " + shown + "/" + goal + "단" : name);

            if (counterId >= 0) {
                views.setViewVisibility(R.id.widget_minus, View.VISIBLE);
                views.setViewVisibility(R.id.widget_plus, View.VISIBLE);
                views.setOnClickPendingIntent(
                        R.id.widget_minus, bumpIntent(context, widgetId, counterId, -1));
                views.setOnClickPendingIntent(
                        R.id.widget_plus, bumpIntent(context, widgetId, counterId, 1));
            } else {
                views.setViewVisibility(R.id.widget_minus, View.GONE);
                views.setViewVisibility(R.id.widget_plus, View.GONE);
            }
        } else {
            views.setTextViewText(R.id.widget_count, "—");
            views.setTextViewText(R.id.widget_caption, "단수 카운터 없음");
            views.setViewVisibility(R.id.widget_minus, View.GONE);
            views.setViewVisibility(R.id.widget_plus, View.GONE);
        }

        Bitmap photo = WidgetData.decode(project.optString("photo", ""));
        if (photo != null) {
            views.setImageViewBitmap(R.id.widget_photo, photo);
            views.setViewVisibility(R.id.widget_photo, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_photo, View.GONE);
        }

        return views;
    }

    private static PendingIntent bumpIntent(
            Context context, int widgetId, int counterId, int delta) {
        Intent intent = new Intent(context, KnitCounterWidgetProvider.class);
        intent.setAction(ACTION_BUMP);
        intent.putExtra(EXTRA_COUNTER_ID, counterId);
        intent.putExtra(EXTRA_DELTA, delta);
        intent.putExtra(EXTRA_WIDGET_ID, widgetId);
        // ⚠️ 위젯마다, +/- 마다 서로 다른 번호를 줘야 한다. 같은 번호를 주면
        //    안드로이드가 하나로 합쳐서 엉뚱한 카운터가 올라간다.
        int requestCode = widgetId * 10 + (delta > 0 ? 1 : 2);
        return PendingIntent.getBroadcast(
                context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
