package com.suki.knittinglog;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 앱이 만든 요약본을 위젯이 읽을 수 있는 곳에 옮겨 둔다.
 *
 * 위젯은 앱과 다른 프로세스에서 돌고, 앱의 IndexedDB(WebView 안에 있다)를
 * 들여다볼 수 없다. 둘이 같이 볼 수 있는 곳은 SharedPreferences 라서
 * 여기를 다리로 쓴다.
 *
 * 한 방향이다 — 앱이 쓰고 위젯이 읽는다. 위젯은 아무것도 쓰지 않는다.
 */
@CapacitorPlugin(name = "KnitWidget")
public class KnitWidgetPlugin extends Plugin {

    /** 위젯과 앱이 같이 보는 곳. KnitWidgetProvider 와 이름이 같아야 한다. */
    public static final String PREFS = "knit_widget";
    public static final String KEY_PAYLOAD = "payload";

    @PluginMethod
    public void update(PluginCall call) {
        String payload = call.getString("payload", "");
        Context context = getContext();

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        // commit() 을 쓴다. apply() 는 나중에 저장하는데, 바로 아래에서 위젯을
        // 깨우기 때문에 위젯이 옛 내용을 읽고 그릴 수 있다.
        prefs.edit().putString(KEY_PAYLOAD, payload).commit();

        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName widget = new ComponentName(context, KnitWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(widget);
        if (ids.length > 0) {
            KnitWidgetProvider.renderAll(context, manager, ids);
        }

        call.resolve();
    }
}
