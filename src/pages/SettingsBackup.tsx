import { useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { db, exportAll, importAll } from '@/lib/db';
import {
  Download,
  Upload,
  ShieldCheck,
  ChevronRight,
  Loader2,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  Wifi,
  PauseCircle,
  Globe,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/sonner';
import {
  calculateYarnSyncDiff, executeYarnSync,
  calculateYarnFetchDiff, executeYarnFetch,
  calculatePatternSyncDiff, executePatternSync,
  calculatePatternFetchDiff, executePatternFetch,
  calculateNeedleSyncDiff, executeNeedleSync,
  calculateNeedleFetchDiff, executeNeedleFetch,
  calculateNotionSyncDiff, executeNotionSync,
  calculateNotionFetchDiff, executeNotionFetch,
  calculateProjectSyncDiff, executeProjectSync,
  calculateProjectFetchDiff, executeProjectFetch,
} from '@/lib/sync';
import {
  type AutoSyncMode,
  type EntitySyncStat,
  type EntityFetchStat,
  type LastResult,
  getAutoSyncMode,
  setAutoSyncMode as persistAutoSyncMode,
  loadLastResult,
  saveLastResult,
  beginSyncRun,
  endSyncRun,
} from '@/lib/syncRunner';
import {
  clearSyncDirty,
  subscribeSyncDirty,
  getLastAutoBackupAt,
} from '@/lib/syncDirty';

function syncToastDetail(stat: EntitySyncStat) {
  const parts = [`↑ ${stat.uploaded}`, `↓ ${stat.downloaded}`, `· ${stat.unchanged}`];
  if (stat.failed > 0) parts.push(`× ${stat.failed}`);
  return parts.join(' / ');
}
function fetchToastDetail(stat: EntityFetchStat) {
  const parts = [`+ ${stat.added}`, `↻ ${stat.updated}`, `· ${stat.unchanged}`];
  if (stat.failed > 0) parts.push(`× ${stat.failed}`);
  return parts.join(' / ');
}

export default function SettingsBackup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [autoMode, setAutoMode] = useState<AutoSyncMode>('off');
  const [dirty, setDirty] = useState(false);
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);

  useEffect(() => {
    setLastResult(loadLastResult());
    setAutoMode(getAutoSyncMode());
    setLastAutoBackup(getLastAutoBackupAt());
    const unsub = subscribeSyncDirty(setDirty);
    return unsub;
  }, []);

  function persistResult(result: LastResult) {
    setLastResult(result);
    saveLastResult(result);
  }

  function handleAutoModeChange(next: AutoSyncMode) {
    setAutoMode(next);
    persistAutoSyncMode(next);
    if (next === 'off') {
      toast.info('자동 백업을 껐어요. 필요할 때 [백업] 버튼으로 진행하세요.');
    } else if (next === 'wifi') {
      toast.success('자동 백업: Wi-Fi 환경에서만 실행돼요.');
    } else {
      toast.success('자동 백업: Wi-Fi와 데이터 모두에서 실행돼요.');
    }
  }

  const handleFetch = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('오프라인 상태예요', { description: '인터넷 연결 후 다시 시도해주세요.' });
      return;
    }
    if (!beginSyncRun()) {
      toast.info('다른 동기화가 진행 중이에요. 끝난 뒤 다시 눌러주세요.');
      return;
    }

    setIsFetching(true);
    const tid = 'fetch-progress';
    try {
      toast.loading('클라우드 데이터 분석 중…', { id: tid });

      const yarnDiff = await calculateYarnFetchDiff(user.uid);
      const patternDiff = await calculatePatternFetchDiff(user.uid);
      const needleDiff = await calculateNeedleFetchDiff(user.uid);
      const notionDiff = await calculateNotionFetchDiff(user.uid);
      const projectDiff = await calculateProjectFetchDiff(user.uid);

      toast.dismiss(tid);

      const confirmMsg =
        '클라우드에서 가져오기:\n\n' +
        `[실] 추가 ${yarnDiff.toAdd.length} / 업데이트 ${yarnDiff.toUpdate.length} / 변경없음 ${yarnDiff.unchanged}\n` +
        `[도안] 추가 ${patternDiff.toAdd.length} / 업데이트 ${patternDiff.toUpdate.length} / 변경없음 ${patternDiff.unchanged}\n` +
        `[바늘] 추가 ${needleDiff.toAdd.length} / 업데이트 ${needleDiff.toUpdate.length} / 변경없음 ${needleDiff.unchanged}\n` +
        `[부자재] 추가 ${notionDiff.toAdd.length} / 업데이트 ${notionDiff.toUpdate.length} / 변경없음 ${notionDiff.unchanged}\n` +
        `[프로젝트] 추가 ${projectDiff.toAdd.length} / 업데이트 ${projectDiff.toUpdate.length} / 변경없음 ${projectDiff.unchanged}\n\n` +
        '이 기기로 데이터를 가져오시겠습니까?';

      if (!confirm(confirmMsg)) {
        setIsFetching(false);
        return;
      }

      toast.loading('실 가져오는 중…', { id: tid });
      const yarnResult = await executeYarnFetch(yarnDiff);
      toast.success(`실 가져오기 완료 · ${fetchToastDetail(yarnResult)}`, { id: tid });

      const ptid = 'fetch-pattern';
      toast.loading('도안 가져오는 중…', { id: ptid });
      const patternResult = await executePatternFetch(patternDiff);
      toast.success(`도안 가져오기 완료 · ${fetchToastDetail(patternResult)}`, { id: ptid });

      const ntid = 'fetch-needle';
      toast.loading('바늘 가져오는 중…', { id: ntid });
      const needleResult = await executeNeedleFetch(needleDiff);
      toast.success(`바늘 가져오기 완료 · ${fetchToastDetail(needleResult)}`, { id: ntid });

      const notid = 'fetch-notion';
      toast.loading('부자재 가져오는 중…', { id: notid });
      const notionResult = await executeNotionFetch(notionDiff);
      toast.success(`부자재 가져오기 완료 · ${fetchToastDetail(notionResult)}`, { id: notid });

      const prtid = 'fetch-project';
      toast.loading('프로젝트(연결관계·카운터·게이지) 가져오는 중…', { id: prtid });
      const projectResult = await executeProjectFetch(projectDiff);
      toast.success(`프로젝트 가져오기 완료 · ${fetchToastDetail(projectResult)}`, { id: prtid });

      const failedTotal =
        yarnResult.failed + patternResult.failed + needleResult.failed +
        notionResult.failed + projectResult.failed;

      const result: LastResult = {
        mode: 'fetch',
        at: new Date().toISOString(),
        entries: [
          { label: '실', stat: yarnResult },
          { label: '도안', stat: patternResult },
          { label: '바늘', stat: needleResult },
          { label: '부자재', stat: notionResult },
          { label: '프로젝트', stat: projectResult },
        ],
      };
      persistResult(result);

      if (failedTotal > 0) {
        toast.warning(`가져오기 완료 · 실패 ${failedTotal}건`, {
          description: '아래 결과 카드를 확인하세요.',
        });
      } else {
        toast.success('가져오기 완료', {
          description: '아래 결과 카드에서 항목별 수치를 확인할 수 있어요.',
        });
      }
    } catch (error) {
      console.error(error);
      toast.error('가져오기 중 오류가 발생했습니다', { id: tid, description: '잠시 후 다시 시도해주세요.' });
    } finally {
      setIsFetching(false);
      endSyncRun();
    }
  };

  const handleSync = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('오프라인 상태예요', { description: '인터넷 연결 후 다시 시도해주세요.' });
      return;
    }
    if (!beginSyncRun()) {
      toast.info('다른 동기화가 진행 중이에요. 끝난 뒤 다시 눌러주세요.');
      return;
    }

    setIsSyncing(true);
    const tid = 'sync-progress';
    try {
      toast.loading('백업 대상 분석 중…', { id: tid });

      const yarnDiff = await calculateYarnSyncDiff(user.uid);
      const patternDiff = await calculatePatternSyncDiff(user.uid);
      const needleDiff = await calculateNeedleSyncDiff(user.uid);
      const notionDiff = await calculateNotionSyncDiff(user.uid);
      const projectDiff = await calculateProjectSyncDiff(user.uid);

      toast.dismiss(tid);

      const confirmMsg =
        '백업 대상 확인 (로컬 ↔ 클라우드):\n\n' +
        `[실] 업로드 ${yarnDiff.toUpload.length} / 다운로드 ${yarnDiff.toDownload.length} / 변경없음 ${yarnDiff.unchanged}\n` +
        `[도안] 업로드 ${patternDiff.toUpload.length} / 다운로드 ${patternDiff.toDownload.length} / 변경없음 ${patternDiff.unchanged}\n` +
        `[바늘] 업로드 ${needleDiff.toUpload.length} / 다운로드 ${needleDiff.toDownload.length} / 변경없음 ${needleDiff.unchanged}\n` +
        `[부자재] 업로드 ${notionDiff.toUpload.length} / 다운로드 ${notionDiff.toDownload.length} / 변경없음 ${notionDiff.unchanged}\n` +
        `[프로젝트] 업로드 ${projectDiff.toUpload.length} / 다운로드 ${projectDiff.toDownload.length} / 변경없음 ${projectDiff.unchanged}\n\n` +
        '지금 백업을 진행하시겠습니까?';

      if (!confirm(confirmMsg)) {
        setIsSyncing(false);
        return;
      }

      toast.loading('실 백업 중…', { id: tid });
      const yarnResult = await executeYarnSync(user.uid, yarnDiff);
      toast.success(`실 백업 완료 · ${syncToastDetail(yarnResult)}`, { id: tid });

      const ptid = 'sync-pattern';
      toast.loading('도안 백업 중…', { id: ptid });
      const patternResult = await executePatternSync(user.uid, patternDiff);
      toast.success(`도안 백업 완료 · ${syncToastDetail(patternResult)}`, { id: ptid });

      const ntid = 'sync-needle';
      toast.loading('바늘 백업 중…', { id: ntid });
      const needleResult = await executeNeedleSync(user.uid, needleDiff);
      toast.success(`바늘 백업 완료 · ${syncToastDetail(needleResult)}`, { id: ntid });

      const notid = 'sync-notion';
      toast.loading('부자재 백업 중…', { id: notid });
      const notionResult = await executeNotionSync(user.uid, notionDiff);
      toast.success(`부자재 백업 완료 · ${syncToastDetail(notionResult)}`, { id: notid });

      const prtid = 'sync-project';
      toast.loading('프로젝트(연결관계·카운터·게이지) 백업 중…', { id: prtid });
      const projectResult = await executeProjectSync(user.uid, projectDiff);
      toast.success(`프로젝트 백업 완료 · ${syncToastDetail(projectResult)}`, { id: prtid });

      const failedTotal =
        yarnResult.failed + patternResult.failed + needleResult.failed +
        notionResult.failed + projectResult.failed;

      const result: LastResult = {
        mode: 'sync',
        at: new Date().toISOString(),
        entries: [
          { label: '실', stat: yarnResult },
          { label: '도안', stat: patternResult },
          { label: '바늘', stat: needleResult },
          { label: '부자재', stat: notionResult },
          { label: '프로젝트', stat: projectResult },
        ],
      };
      persistResult(result);

      if (failedTotal === 0) {
        clearSyncDirty();
      }

      if (failedTotal > 0) {
        toast.warning(`백업 완료 · 실패 ${failedTotal}건`, {
          description: '아래 결과 카드를 확인하세요.',
        });
      } else {
        toast.success('백업 완료', {
          description: '아래 결과 카드에서 항목별 수치를 확인할 수 있어요.',
        });
      }
    } catch (error) {
      console.error(error);
      toast.error('백업 중 오류가 발생했습니다', { id: tid, description: '잠시 후 다시 시도해주세요.' });
    } finally {
      setIsSyncing(false);
      endSyncRun();
    }
  };

  async function handleExport() {
    setBusy(true);
    try {
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const d = new Date().toISOString().slice(0, 10);
      a.download = `knit-backup-${d}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const now = new Date().toISOString();
      localStorage.setItem('lastBackupAt', now);
      toast.success('백업 파일을 저장했습니다');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!confirm('가져온 데이터를 현재 데이터에 병합할까요?')) return;
      await importAll(data);
      toast.success('백업 파일을 가져왔습니다');
    } catch (e: any) {
      toast.error('가져오기 실패', { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="백업 및 동기화" back />

      {/* 클라우드 백업 액션 카드 */}
      {user ? (
        <div className="card-soft overflow-hidden border-primary/20 bg-primary/5">
          <div className="p-4">
            <h3 className="text-[14px] font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              클라우드 백업
            </h3>
            <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">
              로그인한 계정으로 클라우드와 양방향 동기화합니다.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
              ※ 무료 백업에는 사진이 포함되지 않습니다. 사진 클라우드 백업은 추후 프리미엄 기능으로 제공될 예정입니다.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleFetch}
                disabled={isFetching || isSyncing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-[13px] font-semibold text-accent-foreground shadow-sm transition-all active:scale-[0.98] hover:bg-accent/90 disabled:opacity-60"
              >
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
                가져오기
              </button>
              <button
                onClick={handleSync}
                disabled={isSyncing || isFetching}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all active:scale-[0.98] hover:bg-primary/90 disabled:opacity-60"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    진행 중...
                  </>
                ) : ('백업')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="card-soft p-4 text-center text-[13px] text-muted-foreground">
          클라우드 백업은 로그인 후 사용할 수 있어요.
        </p>
      )}

      {/* 자동 백업 설정 */}
      {user && <AutoSyncSection mode={autoMode} onChange={handleAutoModeChange} dirty={dirty} lastAutoBackup={lastAutoBackup} />}

      {/* 마지막 결과 */}
      {lastResult && <LastResultCard result={lastResult} />}

      {/* 로컬 파일 백업 */}
      <Section title="로컬 파일 백업">
        <button
          onClick={handleExport}
          disabled={busy}
          className="card-soft flex w-full items-center gap-3 p-4 transition active:scale-[0.99] hover:shadow-soft disabled:opacity-60 bg-card"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Download className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[13.5px] font-semibold text-foreground">JSON 파일로 내보내기</div>
            <div className="text-[11.5px] text-muted-foreground">기기에 백업 파일을 저장</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="card-soft flex w-full items-center gap-3 p-4 transition active:scale-[0.99] hover:shadow-soft disabled:opacity-60 bg-card"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent-foreground">
            <Upload className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[13.5px] font-semibold text-foreground">JSON 파일에서 가져오기</div>
            <div className="text-[11.5px] text-muted-foreground">백업 파일을 현재 데이터에 병합</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = '';
          }}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="section-title">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

const AUTO_OPTIONS: { value: AutoSyncMode; label: string; desc: string; Icon: typeof Wifi }[] = [
  { value: 'off', label: '자동 백업 끔', desc: '필요할 때만 [백업] 버튼으로 직접 진행', Icon: PauseCircle },
  { value: 'wifi', label: 'Wi-Fi에서만 자동 백업', desc: '데이터 사용 없이 Wi-Fi 환경에서만 자동 실행', Icon: Wifi },
  { value: 'always', label: '항상 자동 백업', desc: 'Wi-Fi와 모바일 데이터 모두에서 자동 실행', Icon: Globe },
];

function AutoSyncSection({
  mode, onChange, dirty, lastAutoBackup,
}: {
  mode: AutoSyncMode;
  onChange: (next: AutoSyncMode) => void;
  dirty: boolean;
  lastAutoBackup: string | null;
}) {
  const lastLabel = lastAutoBackup
    ? new Date(lastAutoBackup).toLocaleString('ko-KR', {
        month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : '없음';
  return (
    <div className="card-soft overflow-hidden bg-card">
      <div className="p-4 border-b border-border/60">
        <h3 className="text-[14px] font-bold text-foreground">자동 백업</h3>
        <p className="mt-1 text-[11.5px] text-muted-foreground leading-relaxed">
          로컬 데이터가 변경되면 자동으로 클라우드에 백업합니다.
        </p>
        <div className="mt-2.5 flex items-center gap-2 text-[11px] tabular-nums">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-semibold ${
              dirty
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dirty ? 'bg-amber-500' : 'bg-green-500'}`} />
            {dirty ? '백업 대기 중' : '최신'}
          </span>
          <span className="text-muted-foreground">· 마지막 자동 백업 {lastLabel}</span>
        </div>
      </div>
      <div role="radiogroup" aria-label="자동 백업 모드" className="divide-y divide-border/60">
        {AUTO_OPTIONS.map((opt) => {
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={`flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/30 active:bg-muted/50 ${
                active ? 'bg-primary/5' : ''
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                <opt.Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-[13px] font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>
                  {opt.label}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{opt.desc}</div>
              </div>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  active ? 'border-primary bg-primary' : 'border-border'
                }`}
              >
                {active && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="px-4 py-3 bg-muted/20 border-t border-border/60">
        <p className="text-[10.5px] text-muted-foreground leading-relaxed">
          ※ 일부 브라우저는 Wi-Fi 여부를 정확히 확인하지 못해요. 그런 경우 'Wi-Fi에서만'은 안전을 위해 자동 백업을 건너뜁니다.
        </p>
      </div>
    </div>
  );
}

function LastResultCard({ result }: { result: LastResult }) {
  const totalFailed = result.entries.reduce((acc, e) => acc + e.stat.failed, 0);
  const at = new Date(result.at).toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const title = result.mode === 'sync' ? '마지막 백업 결과' : '마지막 가져오기 결과';

  return (
    <div className="card-soft p-4 bg-card animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13.5px] font-bold text-foreground flex items-center gap-2">
          {totalFailed > 0 ? (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          )}
          {title}
        </h3>
        <span className="text-[10.5px] text-muted-foreground tabular-nums">{at}</span>
      </div>
      <div className="space-y-1.5 border-t border-border/60 pt-3">
        {result.entries.map((entry) => (
          <ResultRow key={entry.label} label={entry.label} stat={entry.stat} mode={result.mode} />
        ))}
      </div>
      {totalFailed > 0 && (
        <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">
          실패 {totalFailed}건 — 콘솔 로그에서 자세한 원인을 확인할 수 있어요.
        </p>
      )}
    </div>
  );
}

function ResultRow({
  label, stat, mode,
}: {
  label: string; stat: EntitySyncStat | EntityFetchStat; mode: 'sync' | 'fetch';
}) {
  const items =
    mode === 'sync'
      ? [
          { k: '↑', v: (stat as EntitySyncStat).uploaded, tone: 'primary' },
          { k: '↓', v: (stat as EntitySyncStat).downloaded, tone: 'accent' },
          { k: '·', v: stat.unchanged, tone: 'muted' },
        ]
      : [
          { k: '+', v: (stat as EntityFetchStat).added, tone: 'primary' },
          { k: '↻', v: (stat as EntityFetchStat).updated, tone: 'accent' },
          { k: '·', v: stat.unchanged, tone: 'muted' },
        ];
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="font-semibold text-foreground">{label}</span>
      <div className="flex items-center gap-3 tabular-nums">
        {items.map((item) => (
          <span
            key={item.k}
            className={
              item.tone === 'muted' ? 'text-muted-foreground'
              : item.tone === 'accent' ? 'text-accent-foreground'
              : 'text-primary'
            }
          >
            <span className="opacity-60 mr-0.5">{item.k}</span>
            {item.v}
          </span>
        ))}
        {stat.failed > 0 && (
          <span className="text-destructive">
            <span className="opacity-60 mr-0.5">×</span>
            {stat.failed}
          </span>
        )}
      </div>
    </div>
  );
}

// db 사용 — eslint 가 import 안 된 것으로 오인하지 않도록 사용처 확인용
void db;
