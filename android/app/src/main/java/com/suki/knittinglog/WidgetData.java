package com.suki.knittinglog;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;

/** 두 위젯이 같이 쓰는 잔손질 */
final class WidgetData {

    private WidgetData() {}

    /** 고른 프로젝트를 찾는다. 안 골랐으면 맨 앞(가장 최근) */
    static JSONObject pick(String payload, int wanted) {
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

    /** 누르면 그 프로젝트의 '도안 보며 뜨기' 로 */
    static PendingIntent openIntent(Context context, int widgetId, int projectId) {
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (projectId > 0) {
            open.putExtra(KnitCounterWidgetProvider.EXTRA_PROJECT_ID, projectId);
            // ⚠️ Intent 를 구분 짓는 값을 넣어야 한다. 안 그러면 안드로이드가
            //    위젯 여러 개의 PendingIntent 를 같은 것으로 보고, 어느 것을
            //    눌러도 처음 만든 하나의 프로젝트만 열린다.
            open.setAction("knit.open." + projectId);
        }
        return PendingIntent.getActivity(
                context, widgetId, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static Bitmap decode(String base64) {
        if (base64 == null || base64.isEmpty()) return null;
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception e) {
            return null;
        }
    }
}
