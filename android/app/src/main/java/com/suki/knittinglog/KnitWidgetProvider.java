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
 * 보여 주기만 한다. 누르면 앱이 열린다.
 *
 * ⚠️ 위젯에서 단수를 올리게 만들지 말 것.
 *    그러면 위젯과 앱이 각자 다른 값을 들게 되고, 어느 쪽이 맞는지 정할 방법이
 *    마땅치 않다. 단수는 한번 어긋나면 실물을 세어야 돌아온다.
 */
public class KnitWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        renderAll(context, manager, ids);
    }

    static void renderAll(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, build(context));
        }
    }

    private static RemoteViews build(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.knit_widget);

        // 위젯 어디를 눌러도 앱이 열린다
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        views.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(context, 0, open, flags));

        SharedPreferences prefs =
                context.getSharedPreferences(KnitWidgetPlugin.PREFS, Context.MODE_PRIVATE);
        String payload = prefs.getString(KnitWidgetPlugin.KEY_PAYLOAD, "");

        JSONObject first = firstProject(payload);
        if (first == null) {
            // 앱을 아직 한 번도 안 열었거나 뜨는 중인 것이 없다.
            // 빈 위젯을 그대로 두면 고장으로 보이니 무슨 상황인지 적어 준다.
            views.setTextViewText(R.id.widget_title, "뜨개일기");
            views.setTextViewText(R.id.widget_count, "—");
            views.setTextViewText(R.id.widget_caption, "진행중인 프로젝트가 없어요");
            views.setViewVisibility(R.id.widget_photo, View.GONE);
            return views;
        }

        views.setTextViewText(R.id.widget_title, first.optString("name", "프로젝트"));

        JSONArray counters = first.optJSONArray("counters");
        if (counters != null && counters.length() > 0) {
            JSONObject c = counters.optJSONObject(0);
            int count = c == null ? 0 : c.optInt("count", 0);
            int goal = c == null ? 0 : c.optInt("goal", 0);
            views.setTextViewText(R.id.widget_count, String.valueOf(count));
            String name = c == null ? "" : c.optString("name", "");
            views.setTextViewText(
                    R.id.widget_caption,
                    goal > 0 ? name + " · " + count + "/" + goal + "단" : name);
        } else {
            views.setTextViewText(R.id.widget_count, "—");
            views.setTextViewText(R.id.widget_caption, "단수 카운터 없음");
        }

        Bitmap photo = decode(first.optString("photo", ""));
        if (photo != null) {
            views.setImageViewBitmap(R.id.widget_photo, photo);
            views.setViewVisibility(R.id.widget_photo, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_photo, View.GONE);
        }

        return views;
    }

    private static JSONObject firstProject(String payload) {
        if (payload == null || payload.isEmpty()) return null;
        try {
            JSONArray projects = new JSONObject(payload).optJSONArray("projects");
            if (projects == null || projects.length() == 0) return null;
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
