package com.suki.knittinglog;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 앱과 위젯 사이의 다리.
 *
 * 위젯은 앱과 다른 프로세스에서 돌고, 앱의 IndexedDB(WebView 안에 있다)를
 * 들여다볼 수 없다. 둘이 같이 볼 수 있는 곳은 SharedPreferences 라서
 * 여기를 다리로 쓴다.
 *
 * 네 가지를 한다.
 *   update()          앱이 만든 요약본을 위젯이 읽을 곳에 옮긴다
 *   wantedPreviews()  도안 그림이 실제로 필요한 프로젝트만 알려 준다
 *   consumePending()  위젯에서 누른 단수를 앱이 가져간다
 *   consumeTarget()   위젯을 눌러 들어왔을 때 갈 곳을 알려 준다
 */
@CapacitorPlugin(name = "KnitWidget")
public class KnitWidgetPlugin extends Plugin {

    /** 위젯과 앱이 같이 보는 곳. Provider 들과 이름이 같아야 한다. */
    public static final String PREFS = "knit_widget";
    public static final String KEY_PAYLOAD = "payload";
    /** 위젯에서 눌린 만큼 쌓아 두는 칸의 앞머리 */
    public static final String PENDING_PREFIX = "pending_";

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
        int id = intent.getIntExtra(KnitCounterWidgetProvider.EXTRA_PROJECT_ID, 0);
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

    /**
     * 도안 그림이 필요한 프로젝트.
     *
     * 도안 한 쪽을 그리는 데 시간이 꽤 든다. 진행중인 것을 전부 그리면 앱을
     * 나갈 때마다 몇 초씩 걸리므로, 미리보기 위젯이 실제로 붙어 있는 것만
     * 추려서 알려 준다.
     */
    @PluginMethod
    public void wantedPreviews(PluginCall call) {
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        int[] ids = manager.getAppWidgetIds(
                new ComponentName(context, KnitPatternWidgetProvider.class));

        Set<Integer> wanted = new HashSet<>();
        for (int id : ids) {
            int projectId = prefs.getInt(KnitCounterWidgetProvider.projectKey(id), -1);
            if (projectId > 0) wanted.add(projectId);
        }

        JSArray out = new JSArray();
        for (Integer id : wanted) out.put(id);

        JSObject result = new JSObject();
        result.put("projectIds", out);
        call.resolve(result);
    }

    /**
     * 위젯에서 눌린 단수를 가져간다.
     *
     * 위젯은 '지금 몇 단' 이 아니라 '몇 번 눌렸는지' 만 쌓아 둔다. 그래야 앱에서
     * 직접 고친 값과 부딪히지 않는다. 가져가면 비운다.
     */
    @PluginMethod
    public void consumePending(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        JSArray out = new JSArray();
        List<String> done = new ArrayList<>();
        for (Map.Entry<String, ?> entry : prefs.getAll().entrySet()) {
            String key = entry.getKey();
            if (!key.startsWith(PENDING_PREFIX)) continue;
            if (!(entry.getValue() instanceof Integer)) continue;

            int delta = (Integer) entry.getValue();
            if (delta != 0) {
                JSObject item = new JSObject();
                item.put("counterId", Integer.parseInt(key.substring(PENDING_PREFIX.length())));
                item.put("delta", delta);
                out.put(item);
            }
            done.add(key);
        }
        for (String key : done) editor.remove(key);
        editor.commit();

        JSObject result = new JSObject();
        result.put("items", out);
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

        refreshAll(context);
        call.resolve();
    }

    /** 두 종류의 위젯을 모두 다시 그린다 */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);

        int[] counters = manager.getAppWidgetIds(
                new ComponentName(context, KnitCounterWidgetProvider.class));
        if (counters.length > 0) {
            KnitCounterWidgetProvider.renderAll(context, manager, counters);
        }

        int[] patterns = manager.getAppWidgetIds(
                new ComponentName(context, KnitPatternWidgetProvider.class));
        if (patterns.length > 0) {
            KnitPatternWidgetProvider.renderAll(context, manager, patterns);
        }
    }
}
