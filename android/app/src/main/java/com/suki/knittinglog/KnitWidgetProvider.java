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
 * 홈 화면 위젯 — 지금 뜨고 있는 것과 단수를 보여 준다.
 *
 * 위젯 하나가 프로젝트 하나를 본다. 어느 프로젝트인지는 홈에 놓을 때 고르고
 * (KnitWidgetConfigActivity), 위젯 번호별로 따로 기억한다. 그래서 여러 개를
 * 놓고 각각 다른 프로젝트를 띄울 수 있다.
 *
 * 누르면 그 프로젝트 화면이 바로 열린다.
 *
 * ⚠️ 위젯에서 단수를 올리게 만들지 말 것.
 *    그러면 위젯과 앱이 각자 다른 값을 들게 되고, 어느 쪽이 맞는지 정할 방법이
 *    마땅치 않다. 단수는 한번 어긋나면 실물을 세어야 돌아온다.
 */
public class KnitWidgetProvider extends AppWidgetProvider {

    /** MainActivity 가 읽어 갈 목적지 */
    public static final String EXTRA_PROJECT_ID = "knit.projectId";

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

    static void renderAll(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, build(context, id));
        }
    }

    private static RemoteViews build(Context context, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.knit_widget);

        SharedPreferences prefs =
                context.getSharedPreferences(KnitWidgetPlugin.PREFS, Context.MODE_PRIVATE);
        int wanted = prefs.getInt(projectKey(widgetId), -1);
        String payload = prefs.getString(KnitWidgetPlugin.KEY_PAYLOAD, "");

        JSONObject project = pick(payload, wanted);
        int projectId = project == null ? wanted : project.optInt("id", wanted);

        // 누르면 앱이 열린다. 프로젝트를 알면 그 화면으로 바로 간다.
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (projectId > 0) {
            open.putExtra(EXTRA_PROJECT_ID, projectId);
            // ⚠️ Intent 를 구분 짓는 값을 넣어야 한다. 안 그러면 안드로이드가
            //    위젯 여러 개의 PendingIntent 를 같은 것으로 보고, 어느 것을
            //    눌러도 처음 만든 하나의 프로젝트만 열린다.
            open.setAction("knit.open." + projectId);
        }
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        views.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(context, widgetId, open, flags));

        if (project == null) {
            // 앱을 아직 한 번도 안 열었거나, 고른 프로젝트가 '작업 중' 에서 빠졌다.
            // 빈 위젯을 그대로 두면 고장으로 보이니 무슨 상황인지 적어 준다.
            views.setTextViewText(R.id.widget_title, "뜨개일기");
            views.setTextViewText(R.id.widget_count, "—");
            views.setTextViewText(
                    R.id.widget_caption,
                    wanted > 0 ? "작업 중인 프로젝트가 아니에요" : "진행중인 프로젝트가 없어요");
            views.setViewVisibility(R.id.widget_photo, View.GONE);
            return views;
        }

        views.setTextViewText(R.id.widget_title, project.optString("name", "프로젝트"));

        JSONArray counters = project.optJSONArray("counters");
        if (counters != null && counters.length() > 0) {
            // 앱에서 방금 손댄 순서로 담겨 온다. 첫 번째가 지금 뜨고 있는 것.
            JSONObject c = counters.optJSONObject(0);
            int count = c == null ? 0 : c.optInt("count", 0);
            int goal = c == null ? 0 : c.optInt("goal", 0);
            String name = c == null ? "" : c.optString("name", "");
            views.setTextViewText(R.id.widget_count, String.valueOf(count));
            views.setTextViewText(
                    R.id.widget_caption,
                    goal > 0 ? name + " · " + count + "/" + goal + "단" : name);
        } else {
            views.setTextViewText(R.id.widget_count, "—");
            views.setTextViewText(R.id.widget_caption, "단수 카운터 없음");
        }

        Bitmap photo = decode(project.optString("photo", ""));
        if (photo != null) {
            views.setImageViewBitmap(R.id.widget_photo, photo);
            views.setViewVisibility(R.id.widget_photo, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_photo, View.GONE);
        }

        return views;
    }

    /** 고른 프로젝트를 찾는다. 안 골랐거나 사라졌으면 맨 앞(가장 최근) */
    private static JSONObject pick(String payload, int wanted) {
        if (payload == null || payload.isEmpty()) return null;
        try {
            JSONArray projects = new JSONObject(payload).optJSONArray("projects");
            if (projects == null || projects.length() == 0) return null;
            if (wanted > 0) {
                for (int i = 0; i < projects.length(); i++) {
                    JSONObject p = projects.optJSONObject(i);
                    if (p != null && p.optInt("id", -1) == wanted) return p;
                }
                // 고른 프로젝트가 목록에 없다 — 완성했거나 지웠다.
                // 엉뚱한 프로젝트를 대신 보여주면 그게 그건 줄 안다.
                return null;
            }
            return projects.optJSONObject(0);
        } catch (Exception e) {
            // 내용이 깨져 있어도 위젯은 떠야 한다. 빈 상태로 보여 준다.
            return null;
        }
    }

    private static Bitmap decode(String base64) {
        if (base64 == null || base64.isEmpty()) return null;
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception e) {
            return null;
        }
    }
}
