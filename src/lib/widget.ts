// ----------------------------------------------------------------------------
// 홈 화면 위젯에 보낼 요약본
// ----------------------------------------------------------------------------
// ⚠️ 위젯은 IndexedDB 를 못 읽는다. 그건 앱 안(WebView)에만 있는 저장소라,
//    홈 화면에 붙은 위젯이 들여다볼 방법이 없다.
//
//    그래서 앱이 바뀔 때마다 '위젯이 읽을 수 있는 곳'(SharedPreferences)에
//    작은 요약본을 따로 써 둔다. 위젯은 그것만 본다.
//
// 한 방향이다. 앱 → 위젯. 위젯은 아무 값도 바꾸지 않는다.
// 위젯에서 단수를 올리게 만들면 양쪽이 서로 다른 값을 들고 있게 되고, 그러면
// 뜨던 단수가 어긋난다. 단수는 되돌릴 수 없는 값이라 그 위험을 지지 않는다.

import { db, type Project } from '@/lib/db';
import { photoUrls } from '@/lib/photo';

/**
 * 요약본에 담을 프로젝트 수.
 *
 * 위젯 하나에 하나씩 붙이는 구조라, 홈 화면에 여러 개를 놓을 것을 생각해
 * 진행중인 것을 넉넉히 보낸다. 사진까지 딸려 가므로 무한정은 못 보낸다.
 */
const MAX_ITEMS = 12;

/**
 * 사진 한 변의 최대 크기.
 *
 * 위젯에 그림을 넘기는 통로(RemoteViews)는 크기 제한이 빡빡하다. 원본을 그대로
 * 넘기면 TransactionTooLargeException 이 나면서 위젯이 통째로 안 뜬다.
 */
const PHOTO_MAX_DIM = 320;

export interface WidgetCounter {
  name: string;
  count: number;
  goal?: number;
}

export interface WidgetProject {
  id: number;
  name: string;
  /** 작게 줄인 대표 사진 (base64, 접두사 없음). 없으면 빈 문자열 */
  photo: string;
  counters: WidgetCounter[];
}

export interface WidgetSnapshot {
  updatedAt: number;
  projects: WidgetProject[];
}

/** 위젯에 넣을 만큼만 사진을 줄인다. 실패하면 사진 없이 간다 */
async function shrinkForWidget(dataUrl: string): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    const scale = Math.min(1, PHOTO_MAX_DIM / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, 0, 0, w, h);

    const out = canvas.toDataURL('image/jpeg', 0.7);
    const comma = out.indexOf(',');
    return comma < 0 ? '' : out.slice(comma + 1);
  } catch {
    // 사진이 없는 위젯은 심심할 뿐이지만, 여기서 throw 하면 위젯이 아예 안 뜬다
    return '';
  }
}

/** 지금 기기 상태로 요약본을 만든다 */
export async function buildWidgetSnapshot(): Promise<WidgetSnapshot> {
  const projects = await db.projects
    .filter(p => !p.isDeleted && p.status === 'in_progress')
    .toArray();

  // 최근에 손댄 것부터. 홈 화면에는 지금 뜨고 있는 것이 보여야 한다.
  projects.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const picked = projects.slice(0, MAX_ITEMS);

  const out: WidgetProject[] = [];
  for (const p of picked) {
    if (p.id == null) continue;
    const counters = await db.rowCounters
      .where('projectId')
      .equals(p.id)
      .filter(c => !c.isDeleted)
      .toArray();

    out.push({
      id: p.id,
      name: p.name,
      photo: await coverOf(p),
      // 방금 손댄 카운터를 앞으로. 처음 만든 것부터 보여주면 소매를 뜨는데
      // 위젯에는 다 끝난 고무단이 떠 있게 된다.
      counters: counters
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        .map(c => ({ name: c.name, count: c.count, goal: c.goal })),
    });
  }

  return { updatedAt: Date.now(), projects: out };
}

async function coverOf(p: Project): Promise<string> {
  const urls = photoUrls(p.photos ?? []);
  const first = urls[0];
  if (!first || !first.startsWith('data:')) return '';
  return shrinkForWidget(first);
}

/**
 * 요약본을 위젯 쪽에 넘긴다.
 *
 * 웹에서는 아무 일도 하지 않는다 — 홈 화면 위젯이라는 것이 없다.
 * 실패해도 조용히 넘어간다. 위젯이 안 갱신되는 것은 불편할 뿐이지만,
 * 여기서 터지면 방금 단수를 센 화면이 같이 죽는다.
 */
export async function pushWidgetSnapshot(): Promise<void> {
  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;

    const plugin = registerPlugin<KnitWidgetPlugin>('KnitWidget');
    const snapshot = await buildWidgetSnapshot();
    await plugin.update({ payload: JSON.stringify(snapshot) });
  } catch (e) {
    console.warn('[widget] 위젯 갱신 실패 (무시)', e);
  }
}

interface KnitWidgetPlugin {
  update(o: { payload: string }): Promise<void>;
  consumeTarget(): Promise<{ projectId: number }>;
  addListener(
    event: 'openProject',
    fn: (data: { projectId: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

async function nativePlugin(): Promise<KnitWidgetPlugin | null> {
  const { Capacitor, registerPlugin } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) return null;
  return registerPlugin<KnitWidgetPlugin>('KnitWidget');
}

/**
 * 위젯을 눌러 들어왔을 때 갈 곳을 알려 준다.
 *
 * ⚠️ 이벤트(openProject)만 믿으면 안 된다. 위젯을 누르는 순간 앱이
 *    꺼져 있었는지, 백그라운드에 있었는지, 안드로이드가 화면을 새로
 *    만들었는지에 따라 들어오는 길이 다르고, 어떤 길에서는 이벤트를
 *    받을 웹이 아직 없다. 실제로 그래서 프로젝트가 아니라 홈이 떴다.
 *
 *    그래서 '앱이 앞으로 나올 때마다 물어본다'. 네이티브가 목적지를
 *    들고 있으면 넘겨주고 비운다. 어느 길로 들어와도 걸린다.
 *
 * 돌려주는 함수를 부르면 구독을 끊는다.
 */
export function onWidgetOpen(go: (projectId: number) => void): () => void {
  const stops: Array<() => void | Promise<void>> = [];
  let alive = true;

  void (async () => {
    try {
      const plugin = await nativePlugin();
      if (!plugin || !alive) return;

      const ask = async () => {
        if (!alive) return;
        try {
          const { projectId } = await plugin.consumeTarget();
          if (alive && projectId > 0) go(projectId);
        } catch (e) {
          console.warn('[widget] 목적지 확인 실패 (무시)', e);
        }
      };

      // 1) 지금 — 꺼져 있던 앱을 위젯으로 깨운 경우
      await ask();

      // 2) 앞으로 나올 때마다 — 백그라운드에 있던 앱을 위젯으로 부른 경우
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void ask();
      });
      stops.push(() => handle.remove());

      // 3) 덤. 앱이 살아 있을 때는 네이티브가 바로 알려 주기도 한다
      const opened = await plugin.addListener('openProject', ({ projectId }) => {
        if (alive && projectId > 0) go(projectId);
      });
      stops.push(() => opened.remove());
    } catch (e) {
      console.warn('[widget] 위젯 진입 처리 실패 (무시)', e);
    }
  })();

  return () => {
    alive = false;
    for (const stop of stops) void stop();
  };
}

/**
 * 언제 위젯을 새로 그릴지.
 *
 * 단수를 한 번 셀 때마다 사진까지 다시 줄여 넘기면 세는 손이 걸린다.
 * 그래서 '앱을 벗어날 때' 에 맞춘다 — 홈 화면으로 나가는 순간이 곧 위젯을
 * 보게 되는 순간이라, 그때만 맞으면 충분하다.
 */
export function startWidgetSync(): void {
  // 시작할 때 한 번. 앱을 지웠다 깔았거나 위젯을 새로 붙인 경우를 위해서다.
  void pushWidgetSnapshot();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void pushWidgetSnapshot();
  });

  // 안드로이드에서는 위 이벤트가 안 올 때가 있어 앱 상태도 같이 본다
  void (async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import('@capacitor/app');
      await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) void pushWidgetSnapshot();
      });
    } catch (e) {
      console.warn('[widget] 앱 상태 구독 실패 (무시)', e);
    }
  })();
}
