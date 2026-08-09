// ----------------------------------------------------------------------------
// 뜨기 모드 — 도안 보면서 단수 세기
// ----------------------------------------------------------------------------
// 왜 만들었나.
//   도안을 전체 화면으로 보면 단수를 셀 수가 없다. 한 단 뜰 때마다
//   뒤로 → 홈 → +1 → 다시 도안. 열 단이면 마흔 번을 누른다.
//   그래서 화면을 위아래로 갈라 위에는 카운터, 아래에는 도안을 둔다.
//
// 칸막이는 끌어서 옮길 수 있다. 차트가 큰 도안은 아래를 넓히고,
// 카운터가 여럿이면 위를 넓힌다 — 사람마다 도안마다 다르다.
// 옮긴 자리는 기억해 둔다. 매번 다시 맞추게 하면 안 쓰게 된다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now, type PatternFile, type RowCounter } from '@/lib/db';
import { PdfSurface } from '@/components/PdfViewer';
import { getPatternFile } from '@/lib/patternFile';
import { ChevronLeft, Plus, Minus, GripHorizontal, FileText, Loader2 } from 'lucide-react';

function vibrate(ms = 10) {
  try { (navigator as any).vibrate?.(ms); } catch { /* 진동을 못 켜도 그만 */ }
}

/** 위 칸 높이를 기억해 두는 자리 */
const SPLIT_KEY = 'knitMode:topHeight';
const MIN_TOP = 96;
const MIN_BOTTOM = 180;

export default function KnitMode() {
  const { id } = useParams();
  const pid = Number(id);
  const nav = useNavigate();

  const project = useLiveQuery(() => db.projects.get(pid), [pid]);
  const counters = useLiveQuery(
    () => db.rowCounters.where('projectId').equals(pid).filter(c => !c.isDeleted).sortBy('createdAt'),
    [pid],
  ) || [];
  const patternLinks = useLiveQuery(
    () => db.projectPatterns.where('projectId').equals(pid).toArray(),
    [pid],
  ) || [];

  // 이 프로젝트에 걸린 도안 중 PDF 가 있는 것들
  const filed = useLiveQuery(async () => {
    const ids = patternLinks.map(l => l.patternId);
    if (!ids.length) return [];
    const files = await db.patternFiles.where('patternId').anyOf(ids).toArray();
    const patterns = await db.patterns.bulkGet(files.map(f => f.patternId));
    return files.map((f, i) => ({ patternId: f.patternId, name: patterns[i]?.name || f.name }));
  }, [patternLinks.map(l => l.patternId).join(',')]) || [];

  const [pickedId, setPickedId] = useState<number | null>(null);
  const [file, setFile] = useState<PatternFile | null>(null);
  const [loadingFile, setLoadingFile] = useState(true);

  // 고른 도안이 없으면 첫 번째를 연다
  const activeId = pickedId ?? filed[0]?.patternId ?? null;

  useEffect(() => {
    let alive = true;
    if (activeId == null) {
      setFile(null);
      setLoadingFile(filed.length > 0);
      return;
    }
    setLoadingFile(true);
    getPatternFile(activeId).then(f => {
      if (alive) {
        setFile(f ?? null);
        setLoadingFile(false);
      }
    });
    return () => { alive = false; };
  }, [activeId, filed.length]);

  // ── 칸막이 ────────────────────────────────────────────────────────────
  const wrapRef = useRef<HTMLDivElement>(null);
  const [topHeight, setTopHeight] = useState(() => {
    const saved = Number(localStorage.getItem(SPLIT_KEY));
    return saved >= MIN_TOP ? saved : 168;
  });
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const clamp = useCallback((h: number) => {
    const total = wrapRef.current?.clientHeight ?? window.innerHeight;
    return Math.max(MIN_TOP, Math.min(h, total - MIN_BOTTOM));
  }, []);

  function onDragStart(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startH: topHeight };
  }
  function onDragMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setTopHeight(clamp(d.startH + (e.clientY - d.startY)));
  }
  function onDragEnd(e: React.PointerEvent) {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    localStorage.setItem(SPLIT_KEY, String(topHeight));
  }

  // 화면이 돌아가면 넣어둔 높이가 화면 밖으로 나갈 수 있다
  useEffect(() => {
    const onResize = () => setTopHeight(h => clamp(h));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  // ── 화면이 꺼지지 않게 ─────────────────────────────────────────────────
  // 도안을 보며 뜨는 동안은 화면을 만지지 않는 시간이 길다. 몇 분마다 꺼지면
  // 그때마다 손을 닦고 켜야 한다. 브라우저가 안 들어주면 그냥 넘어간다.
  useEffect(() => {
    let lock: any = null;
    let released = false;

    const acquire = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request?.('screen');
      } catch { /* 배터리 절약 모드 등에서는 거절된다 */ }
    };
    void acquire();

    // 앱을 잠깐 벗어났다 돌아오면 잠금이 풀려 있다
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      try { lock?.release?.(); } catch { /* 이미 풀렸으면 그만 */ }
    };
  }, []);

  if (!project) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
        프로젝트를 찾지 못했어요.
      </div>
    );
  }

  return (
    // 앱 기본 여백을 벗어나 화면을 꽉 채운다. 뜨기 모드는 도안이 주인공이라
    // 좌우 여백에 내줄 자리가 없다.
    <div
      ref={wrapRef}
      className="fixed inset-0 z-50 flex flex-col bg-neutral-900"
      style={{ paddingTop: 'env(safe-area-inset-top,0px)' }}
    >
      {/* 머리 */}
      <div className="flex shrink-0 items-center gap-1 px-1.5 py-1.5">
        <button
          type="button"
          onClick={() => nav(-1)}
          aria-label="뒤로"
          className="rounded-full p-2 text-white/80 hover:bg-white/10"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">
          {project.name}
        </div>
        {/* 도안이 여럿이면 골라 볼 수 있게 */}
        {filed.length > 1 && (
          <select
            value={activeId ?? ''}
            onChange={e => setPickedId(Number(e.target.value))}
            aria-label="도안 고르기"
            className="max-w-[8rem] rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[12px] text-white outline-none"
          >
            {filed.map(f => (
              <option key={f.patternId} value={f.patternId} className="text-black">
                {f.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 위 칸 — 카운터 */}
      <div
        className="shrink-0 overflow-x-auto overflow-y-hidden px-2"
        style={{ height: topHeight }}
      >
        {counters.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Link
              to={`/projects/${pid}/edit`}
              className="rounded-full border border-dashed border-white/30 px-4 py-2 text-[12.5px] font-semibold text-white/70"
            >
              단수 카운터를 먼저 만들어 주세요
            </Link>
          </div>
        ) : (
          <div className="flex h-full gap-2 py-1">
            {counters.map(c => (
              <CompactCounter key={c.id} counter={c} single={counters.length === 1} />
            ))}
          </div>
        )}
      </div>

      {/* 칸막이 — 끌어서 나눈다 */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        role="separator"
        aria-label="칸 나누기"
        // 손가락으로 잡기 좋게 위아래로 넉넉히 준다. 얇으면 안 잡힌다.
        className="flex shrink-0 cursor-row-resize touch-none items-center justify-center py-1.5"
      >
        <div className="flex h-1.5 w-16 items-center justify-center rounded-full bg-white/25">
          <GripHorizontal className="h-3 w-3 text-white/50" />
        </div>
      </div>

      {/* 아래 칸 — 도안 */}
      {loadingFile ? (
        <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">도안을 여는 중…</span>
        </div>
      ) : file ? (
        <PdfSurface
          file={file}
          rememberKey={String(file.patternId)}
          className="flex-1 pb-[env(safe-area-inset-bottom,0px)]"
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <FileText className="h-8 w-8 text-white/30" />
          <p className="text-[13px] leading-relaxed text-white/70">
            이 프로젝트에 연결된 도안 중 PDF 파일이 있는 게 없어요.
            <br />
            도안 수정 화면에서 PDF 를 넣으면 여기서 바로 볼 수 있어요.
          </p>
          <Link
            to="/library/patterns"
            className="rounded-full bg-white/10 px-4 py-2 text-[12.5px] font-semibold text-white/90"
          >
            도안 보관함 열기
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * 뜨기 모드용 카운터.
 *
 * 라이브러리의 카운터 카드와 달리 이름 수정·목표 설정 같은 것은 없다.
 * 뜨는 중에 필요한 건 숫자와 +/− 뿐이고, 자리는 좁다.
 */
function CompactCounter({ counter, single }: { counter: RowCounter; single: boolean }) {
  async function bump(delta: number) {
    const next = Math.max(0, counter.count + delta);
    if (next === counter.count) return;
    vibrate(delta > 0 ? 10 : 8);
    await db.rowCounters.update(counter.id!, { count: next, updatedAt: now() });
  }

  const pct = counter.goal && counter.goal > 0
    ? Math.min(100, Math.round((counter.count / counter.goal) * 100))
    : null;

  return (
    <div
      className={`flex h-full shrink-0 flex-col justify-center rounded-2xl bg-white/10 px-3 py-2 ${
        single ? 'w-full' : 'w-[64vw] max-w-[16rem]'
      }`}
    >
      <div className="truncate text-[11px] text-white/60">{counter.name}</div>

      <div className="flex items-baseline gap-1">
        <span className="text-[30px] font-extrabold leading-none tabular-nums text-white">
          {counter.count}
        </span>
        <span className="text-[11.5px] text-white/50">
          {counter.goal ? `/ ${counter.goal}단` : '단'}
        </span>
      </div>

      {pct !== null && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* 뜨면서 손끝으로 누르는 버튼이라 크게 둔다. 더하기가 훨씬 자주 눌린다. */}
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => bump(-1)}
          disabled={counter.count <= 0}
          aria-label="한 단 빼기"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition active:scale-90 disabled:opacity-30"
        >
          <Minus className="h-5 w-5" strokeWidth={2.6} />
        </button>
        <button
          type="button"
          onClick={() => bump(1)}
          aria-label="한 단 더하기"
          className="flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-95"
        >
          <Plus className="h-5 w-5" strokeWidth={2.8} />
        </button>
      </div>
    </div>
  );
}
