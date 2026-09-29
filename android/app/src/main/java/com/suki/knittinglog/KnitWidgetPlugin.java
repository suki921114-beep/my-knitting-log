package com.suki.knittinglog;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 앱과 위젯 사이의 다리.
 *
 * 두 가지를 한다.
 *   1) 앱이 만든 요약본을 위젯이 읽을 수 있는 곳에 옮겨 둔다.
 *   2) 위젯을 눌러 들어왔을 때 어디로 가야 하는지 웹 쪽에 알려 준다.
 *
 * 위젯은 앱과 다른 프로세스에서 돌고, 앱의 IndexedDB(WebView 안에 있다)를
 * 들여다볼 수 없다. 둘이 같이 볼 수 있는 곳은 SharedPreferences 라서
 * 여기를 다리로 쓴다.
 */
@CapacitorPlugin(name = "KnitWidget")
public class KnitWidgetPlugin extends Plugin {

    /** 위젯과 앱이 같이 보는 곳. KnitWidgetProvider 와 이름이 같아야 한다. */
    public static final String PREFS = "knit_widget";
    public static final String KEY_PAYLOAD = "payload";

    /**
     * 위젯을 눌러서 가려던 프로젝트.
     *
     * static 으로 둔다 — 위젯을 눌러 앱이 처음 뜨는 순간에는 플러그인 객체가
     * 아직 없을 수도 있어서, 객체에 담아 두면 그 값을 잃는다.
     */
    private static int pendingProjectId = 0;
    private static KnitWidgetPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    /** MainActivity 가 위젯에서 들어온 Intent 를 넘겨 준다 */
    static void rememberTarget(Intent intent) {
        if (intent == null) return;
        int id = intent.getIntExtra(KnitWidgetProvider.EXTRA_PROJECT_ID, 0);
        if (id > 0) pendingProjectId = id;
    }

    /** 앱이 이미 떠 있을 때 — 웹에 바로 알린다 */
    static void notifyTarget() {
        if (instance == null || pendingProjectId <= 0) return;
        JSObject data = new JSObject();
        data.put("projectId", pendingProjectId);
        pendingProjectId = 0;
        instance.notifyListeners("openProject", data);
    }

    /**
     * 웹이 준비된 뒤 가져간다.
     *
     * 한 번 가져가면 비운다 — 안 비우면 앱을 열 때마다 그 프로젝트로 끌려간다.
     */
    @PluginMethod
    public void consumeTarget(PluginCall call) {
        JSObject result = new JSObject();
        result.put("projectId", pendingProjectId);
        pendingProjectId = 0;
        call.resolve(result);
    }

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
