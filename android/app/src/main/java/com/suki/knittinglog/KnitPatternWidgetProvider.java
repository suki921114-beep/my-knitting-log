package com.suki.knittinglog;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;

/**
 * 도안 미리보기 위젯 — 보던 도안 한 쪽을 홈 화면에 띄워 둔다.
 *
 * 차트 도안은 단수를 세는 대신 무늬를 보고 뜬다. 그럴 때 필요한 것은 숫자가
 * 아니라 도안 그 자체라, 폰을 켜지 않고도 다음 칸을 볼 수 있게 한다.
 *
 * 그림은 앱이 그려서 넘겨 준다 (widgetPreview.ts). 형광펜 자국도 같이 얹혀
 * 온다 — 어디까지 떴는지가 안 보이면 띄워 둘 이유가 없다.
 */
public class KnitPatternWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        renderAll(context, manager, ids);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        SharedPreferences prefs =
                context.getSharedPreferences(KnitWidgetPlugin.PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        for (int id : ids) editor.remove(KnitCounterWidgetProvider.projectKey(id));
        editor.apply();
    }

    static void renderAll(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, build(context, id));
        }
    }

    private static RemoteViews build(Context context, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.knit_widget_pattern);

        SharedPreferences prefs =
                context.getSharedPreferences(KnitWidgetPlugin.PREFS, Context.MODE_PRIVATE);
        int wanted = prefs.getInt(KnitCounterWidgetProvider.projectKey(widgetId), -1);
        String payload = prefs.getString(KnitWidgetPlugin.KEY_PAYLOAD, "");

        JSONObject project = WidgetData.pick(payload, wanted);
        int projectId = project == null ? wanted : project.optInt("id", wanted);

        views.setOnClickPendingIntent(
                R.id.widget_root, WidgetData.openIntent(context, widgetId, projectId));

        if (project == null) {
            views.setTextViewText(R.id.widget_title, "뜨개일기");
            views.setTextViewText(
                    R.id.widget_hint,
                    wanted > 0 ? "작업 중인 프로젝트가 아니에요" : "진행중인 프로젝트가 없어요");
            views.setViewVisibility(R.id.widget_hint, View.VISIBLE);
            views.setViewVisibility(R.id.widget_page, View.GONE);
            return views;
        }

        views.setTextViewText(R.id.widget_title, project.optString("name", "프로젝트"));

        Bitmap page = WidgetData.decode(project.optString("preview", ""));
        if (page != null) {
            views.setImageViewBitmap(R.id.widget_page, page);
            views.setViewVisibility(R.id.widget_page, View.VISIBLE);
            views.setViewVisibility(R.id.widget_hint, View.GONE);
        } else {
            // 도안이 없거나 아직 안 그려졌다. 빈 칸을 두면 고장으로 보인다.
            views.setViewVisibility(R.id.widget_page, View.GONE);
            views.setViewVisibility(R.id.widget_hint, View.VISIBLE);
            views.setTextViewText(R.id.widget_hint, "PDF 도안을 넣고 앱에서 한 번 열어주세요");
        }

        return views;
    }
}
