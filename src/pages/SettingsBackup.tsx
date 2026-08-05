import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
  calculateLogSyncDiff, executeLogSync,
  calculateLogFetchDiff, executeLogFetch,
} from '@/lib/sync';
import {
  type AutoSyncMode,
  type EntitySyncStat,
  type EntityFetchStat,
  type LastResult,
  type NetworkKind,
  getAutoSyncMode,
  setAutoSyncMode as persistAutoSyncMode,
  loadLastResult,
  saveLastResult,
  beginSyncRun,
  endSyncRun,
  getNetworkKind,
  runFullRestore,
} from '@/lib/syncRunner';
import { readUsage, takeSkippedPhotos, takeFailedPhotoDownloads } from '@/lib/cloudUsage';
import { SHOW_AUTO_BACKUP, SHOW_SYNC_RESULT } from '@/lib/featureFlags';
import {
  FREE_QUOTA_BYTES,
  MAX_PHOTO_BYTES,
  EMPTY_USAGE,
  formatBytes,
  usageRatio,
  describeRejection,
  type StorageUsage,
} from '@/lib/quota';
import {
  clearSyncDirty,
  subscribeSyncDirty,
  getLastAutoBackupAt,
} from '@/lib/syncDirty';

/**
 * 백업은 '올리기' 만 한다.
 *
 * 예전에는 백업 한 번에 업로드와 다운로드를 함께 했다. 그러다 보니 데이터를
 * 전체 삭제한 뒤 [백업] 을 누르면 클라우드에서 도로 내려와 지운 것이 되살아났다.
 * 받아오는 것은 [가져오기] 와 [클라우드 상태로 되돌리기] 가 맡는다.
 */
function uploadOnly<T extends { toDownload: unknown[] }>(diff: T): T {
  return { ...diff, toDownload: [] };
}

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
  const { confirm, dialog } = useConfirm();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [autoMode, setAutoMode] = useState<AutoSyncMode>('off');
  const [dirty, setDirty] = useState(false);
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);
  const [usage, setUsage] = useState<StorageUsage>(EMPTY_USAGE);
  const [restoreStep, setRestoreStep] = useState<0 | 1 | 2>(0);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    setLastResult(loadLastResult());
    setAutoMode(getAutoSyncMode());
    setLastAutoBackup(getLastAutoBackupAt());
    const unsub = subscribeSyncDirty(setDirty);
    return unsub;
  }, []);

  // 사진 보관 사용량 — 로그인 후, 그리고 백업/가져오기가 끝날 때마다 새로 읽는다
  const refreshUsage = useCallback(async () => {
    if (!user) return setUsage(EMPTY_USAGE);
    setUsage(await readUsage(user.uid));
  }, [user]);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  /** 상한에 걸려 못 올린 사진이 있으면 알려 준다 */
  function notifySkippedPhotos() {
    const skipped = takeSkippedPhotos();
    if (!skipped) return;
    toast.warning(`사진 ${skipped.count}장을 올리지 못했어요`, {
      description: describeRejection(skipped.reason),
      duration: 9000,
    });
  }

  /** 받아오지 못한 사진이 있으면 알려 준다 — 조용히 넘어가면 사진이 없는 줄 안다 */
  function notifyFailedPhotos() {
    const failed = takeFailedPhotoDownloads();
    if (!failed) return;
    toast.warning(`사진 ${failed}장을 받아오지 못했어요`, {
      description: '다음 가져오기에서 다시 시도해요. 계속 실패하면 설정 → 버그 신고의 로그를 보내주세요.',
      duration: 9000,
    });
  }

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
      const kind = getNetworkKind();
      if (kind === 'unknown') {
        // 사용자가 인지할 수 있도록 경고: 이 브라우저에선 wifi 모드가 거의 작동 안 함
        toast.warning('Wi-Fi 감지를 지원하지 않는 브라우저예요', {
          description: "현재 환경에선 자동 백업이 거의 실행되지 않아요. '항상' 모드를 권장해요.",
          duration: 8000,
        });
      } else {
        toast.success('자동 백업: Wi-Fi 환경에서만 실행돼요.');
      }
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
      const logDiff = await calculateLogFetchDiff(user.uid);

      toast.dismiss(tid);

      const rows: DiffRow[] = [
        { label: '실', a: yarnDiff.toAdd.length, b: yarnDiff.toUpdate.length, same: yarnDiff.unchanged },
        { label: '도안', a: patternDiff.toAdd.length, b: patternDiff.toUpdate.length, same: patternDiff.unchanged },
        { label: '바늘', a: needleDiff.toAdd.length, b: needleDiff.toUpdate.length, same: needleDiff.unchanged },
        { label: '부자재', a: notionDiff.toAdd.length, b: notionDiff.toUpdate.length, same: notionDiff.unchanged },
        { label: '프로젝트', a: projectDiff.toAdd.length, b: projectDiff.toUpdate.length, same: projectDiff.unchanged },
        { label: '일기', a: logDiff.toAdd.length, b: logDiff.toUpdate.length, same: logDiff.unchanged },
      ];

      const ok = await confirm({
        title: '이 기기로 데이터를 가져올까요?',
        description: <DiffTable rows={rows} aLabel="추가" bLabel="업데이트" />,
        confirmLabel: '가져오기',
        destructive: false,
      });
      if (!ok) {
        setIsFetching(false);
        return;
      }

      toast.loading('실 가져오는 중…', { id: tid });
      const yarnResult = await executeYarnFetch(yarnDiff);

      toast.loading('도안 가져오는 중…', { id: tid });
      const patternResult = await executePatternFetch(patternDiff);

      toast.loading('바늘 가져오는 중…', { id: tid });
      const needleResult = await executeNeedleFetch(needleDiff);

      toast.loading('부자재 가져오는 중…', { id: tid });
      const notionResult = await executeNotionFetch(notionDiff);

      toast.loading('프로젝트(연결관계·카운터·게이지) 가져오는 중…', { id: tid });
      const projectResult = await executeProjectFetch(projectDiff);

      // 일기는 프로젝트 cloudId 를 참조하므로 프로젝트를 받은 뒤에 실행한다
      toast.loading('일기 가져오는 중…', { id: tid });
      const logResult = await executeLogFetch(logDiff);

      const failedTotal =
        yarnResult.failed + patternResult.failed + needleResult.failed +
        notionResult.failed + projectResult.failed + logResult.failed;

      const result: LastResult = {
        mode: 'fetch',
        at: new Date().toISOString(),
        entries: [
          { label: '실', stat: yarnResult },
          { label: '도안', stat: patternResult },
          { label: '바늘', stat: needleResult },
          { label: '부자재', stat: notionResult },
          { label: '프로젝트', stat: projectResult },
          { label: '일기', stat: logResult },
        ],
      };
      persistResult(result);

      if (failedTotal > 0) {
        toast.warning(`가져오기 완료 · 실패 ${failedTotal}건`, {
          id: tid,
          description: '아래 결과 카드를 확인하세요.',
        });
      } else {
        toast.success('가져오기 완료', {
          id: tid,
          description: '아래 결과 카드에서 항목별 수치를 확인할 수 있어요.',
        });
      }
    } catch (error) {
      console.error(error);
      toast.error('가져오기 중 오류가 발생했습니다', { id: tid, description: '잠시 후 다시 시도해주세요.' });
    } finally {
      setIsFetching(false);
      endSyncRun();
      notifyFailedPhotos();
      void refreshUsage();
    }
  };

  /**
   * 클라우드 상태로 되돌리기.
   * 일반 [가져오기] 는 이 기기에서 방금 바꾼 것을 보호하지만, 되돌리기는
   * 그 보호를 건너뛰고 클라우드 내용으로 덮어쓴다.
   */
  const handleRestore = async () => {
    if (!user) return;
    if (!beginSyncRun()) {
      toast.info('다른 동기화가 진행 중이에요. 끝난 뒤 다시 눌러주세요.');
      return;
    }
    setRestoring(true);
    const tid = 'restore-progress';
    try {
      toast.loading('클라우드 상태로 되돌리는 중…', { id: tid });
      const { result, failed } = await runFullRestore(user.uid);
      persistResult(result);
      if (failed > 0) {
        toast.warning(`되돌리기 완료 · 실패 ${failed}건`, { id: tid, description: '아래 결과 카드를 확인하세요.' });
      } else {
        toast.success('클라우드 상태로 되돌렸어요', { id: tid });
      }
    } catch (error) {
      console.error(error);
      toast.error('되돌리기 중 오류가 발생했습니다', { id: tid, description: '잠시 후 다시 시도해주세요.' });
    } finally {
      setRestoring(false);
      setRestoreStep(0);
      endSyncRun();
      notifyFailedPhotos();
      void refreshUsage();
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

      const yarnDiff = uploadOnly(await calculateYarnSyncDiff(user.uid));
      const patternDiff = uploadOnly(await calculatePatternSyncDiff(user.uid));
      const needleDiff = uploadOnly(await calculateNeedleSyncDiff(user.uid));
      const notionDiff = uploadOnly(await calculateNotionSyncDiff(user.uid));
      const projectDiff = uploadOnly(await calculateProjectSyncDiff(user.uid));
      const logDiff = uploadOnly(await calculateLogSyncDiff(user.uid));

      toast.dismiss(tid);

      const rows: DiffRow[] = [
        { label: '실', a: yarnDiff.toUpload.length, b: 0, same: yarnDiff.unchanged },
        { label: '도안', a: patternDiff.toUpload.length, b: 0, same: patternDiff.unchanged },
        { label: '바늘', a: needleDiff.toUpload.length, b: 0, same: needleDiff.unchanged },
        { label: '부자재', a: notionDiff.toUpload.length, b: 0, same: notionDiff.unchanged },
        { label: '프로젝트', a: projectDiff.toUpload.length, b: 0, same: projectDiff.unchanged },
        { label: '일기', a: logDiff.toUpload.length, b: 0, same: logDiff.unchanged },
      ];

      const ok = await confirm({
        title: '이 기기의 기록을 클라우드에 올릴까요?',
        description: <DiffTable rows={rows} aLabel="올릴 항목" bLabel="변경 없음" hideB={true} />,
        confirmLabel: '백업',
        destructive: false,
      });
      if (!ok) {
        setIsSyncing(false);
        return;
      }

      toast.loading('실 백업 중…', { id: tid });
      const yarnResult = await executeYarnSync(user.uid, yarnDiff);

      toast.loading('도안 백업 중…', { id: tid });
      const patternResult = await executePatternSync(user.uid, patternDiff);

      toast.loading('바늘 백업 중…', { id: tid });
      const needleResult = await executeNeedleSync(user.uid, needleDiff);

      toast.loading('부자재 백업 중…', { id: tid });
      const notionResult = await executeNotionSync(user.uid, notionDiff);

      toast.loading('프로젝트(연결관계·카운터·게이지) 백업 중…', { id: tid });
      const projectResult = await executeProjectSync(user.uid, projectDiff);

      toast.loading('일기 백업 중…', { id: tid });
      const logResult = await executeLogSync(user.uid, logDiff);

      const failedTotal =
        yarnResult.failed + patternResult.failed + needleResult.failed +
        notionResult.failed + projectResult.failed + logResult.failed;

      const result: LastResult = {
        mode: 'sync',
        at: new Date().toISOString(),
        entries: [
          { label: '실', stat: yarnResult },
          { label: '도안', stat: patternResult },
          { label: '바늘', stat: needleResult },
          { label: '부자재', stat: notionResult },
          { label: '프로젝트', stat: projectResult },
          { label: '일기', stat: logResult },
        ],
      };
      persistResult(result);

      if (failedTotal === 0) {
        clearSyncDirty();
      }

      if (failedTotal > 0) {
        toast.warning(`백업 완료 · 실패 ${failedTotal}건`, {
          id: tid,
          description: '아래 결과 카드를 확인하세요.',
        });
      } else {
        toast.success('백업 완료', {
          id: tid,
          description: '아래 결과 카드에서 항목별 수치를 확인할 수 있어요.',
        });
      }
    } catch (error) {
      console.error(error);
      toast.error('백업 중 오류가 발생했습니다', { id: tid, description: '잠시 후 다시 시도해주세요.' });
    } finally {
      setIsSyncing(false);
      endSyncRun();
      notifySkippedPhotos();
      void refreshUsage();
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
      const ok = await confirm({
        title: '백업 파일을 불러올까요?',
        description: '파일의 내용이 현재 데이터에 병합됩니다. 같은 항목은 덮어쓰이고, 없는 항목은 추가돼요.',
        confirmLabel: '가져오기',
        destructive: false,
      });
      if (!ok) return;
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
      {dialog}

      {/* 1. 내 기기로 백업 — 사진까지 통째로 보관되는 유일한 방법이라 최우선 배치 */}
      <Section title="내 기기로 백업" badge="권장">
        <button
          onClick={handleExport}
          disabled={busy}
          className="card-soft flex w-full items-center gap-3 border-primary/20 bg-primary/5 p-4 transition active:scale-[0.99] hover:shadow-soft disabled:opacity-60"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[13.5px] font-semibold text-foreground">내 기기로 내보내기</div>
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
            <div className="text-[13.5px] font-semibold text-foreground">내 기기에서 가져오기</div>
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
        <p className="px-1 text-[10.5px] leading-relaxed text-muted-foreground">
          기기를 바꾸거나 앱을 지우기 전에는 꼭 한 번 내보내 두세요. 사진을 포함해 모든 기록이 파일 하나에 담깁니다.
        </p>
      </Section>

      {/* 2. 클라우드 백업 액션 카드 */}
      {user ? (
        <div className="card-soft overflow-hidden border-primary/20 bg-primary/5">
          <div className="p-4">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              클라우드 백업
              <PhotoWarningPopover />
            </h3>
            <UsageGauge usage={usage} />
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

            {/*
              가져오기는 '최신 것이 이긴다' 병합이라, 이 기기에서 방금 지우거나
              바꾼 것은 그대로 남는다. 실수로 지웠을 때를 위한 탈출구를 따로 둔다.
            */}
            <button
              onClick={() => setRestoreStep(1)}
              disabled={isSyncing || isFetching || restoring}
              className="mt-3 w-full text-center text-[11.5px] text-muted-foreground underline underline-offset-4 disabled:opacity-50"
            >
              {restoring ? '되돌리는 중…' : '클라우드 상태로 되돌리기'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card-soft p-4 text-center">
          <p className="text-[13px] text-muted-foreground">클라우드 백업은 로그인 후 사용할 수 있어요.</p>
          <div className="mt-2 flex justify-center">
            <PhotoWarningPopover label="사진 백업 안내" />
          </div>
        </div>
      )}

      {/* 자동 백업 — 추후 프리미엄 기능으로 검토 중이라 UI 만 감춰 둔다 (코드는 유지) */}
      {SHOW_AUTO_BACKUP && user && (
        <AutoSyncSection mode={autoMode} onChange={handleAutoModeChange} dirty={dirty} lastAutoBackup={lastAutoBackup} />
      )}

      {/* 되돌리기 1단계 */}
      <ConfirmDialog
        open={restoreStep === 1}
        onOpenChange={(o) => !o && setRestoreStep(0)}
        title="클라우드 상태로 되돌릴까요?"
        description={
          <span>
            마지막으로 백업한 시점의 내용으로 이 기기를 되돌립니다.
            {' '}백업 이후 이 기기에서 지우거나 고친 내용은 <strong>사라집니다.</strong>
            {' '}클라우드에 없는 기록(백업한 적 없는 것)은 그대로 남아요.
          </span>
        }
        confirmLabel="다음"
        cancelLabel="취소"
        destructive
        closeOnConfirm={false}
        onConfirm={() => setRestoreStep(2)}
      />

      {/* 되돌리기 2단계 */}
      <ConfirmDialog
        open={restoreStep === 2}
        onOpenChange={(o) => !o && setRestoreStep(0)}
        title="되돌릴 수 없어요. 계속할까요?"
        description="지금 이 기기의 내용이 클라우드 백업으로 덮어써집니다."
        confirmLabel="되돌리기"
        cancelLabel="취소"
        destructive
        busy={restoring}
        onConfirm={handleRestore}
      />

      {/* 마지막 백업 결과 — 사용자가 알 필요는 없어 감춰 둔다 (진단이 필요하면 다시 켠다) */}
      {SHOW_SYNC_RESULT && lastResult && <LastResultCard result={lastResult} />}
    </div>
  );
}

/** 사진 보관 사용량 막대 — 320MB / 1GB */
function UsageGauge({ usage }: { usage: StorageUsage }) {
  const ratio = usageRatio(usage.bytes);
  const pct = Math.round(ratio * 100);
  const nearFull = ratio >= 0.9;

  return (
    <div className="mt-3.5">
      <div className="flex items-baseline justify-between text-[11.5px]">
        <span className="font-semibold text-foreground">사진 보관함</span>
        <span className={`tabular-nums ${nearFull ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
          {formatBytes(usage.bytes)} / {formatBytes(FREE_QUOTA_BYTES)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-all ${nearFull ? 'bg-amber-500' : 'bg-primary'}`}
          style={{ width: `${Math.max(pct, usage.bytes > 0 ? 2 : 0)}%` }}
        />
      </div>
      {usage.photoCount > 0 && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">사진 {usage.photoCount}장 보관 중</p>
      )}
    </div>
  );
}

/**
 * 클라우드 백업 옆의 ! 아이콘 — 눌러서 사진 보관 안내를 띄운다.
 * 모바일에서도 동작하도록 hover 툴팁이 아닌 popover(탭) 방식.
 */
function PhotoWarningPopover({ label }: { label?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="사진 백업 안내"
          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700 transition hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          {label && <span className="text-[11px] font-semibold">{label}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-[12px] leading-relaxed">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">사진은 1GB까지 보관돼요</p>
            <p className="text-muted-foreground">
              프로젝트 사진도 함께 올라가서 폰과 태블릿에서 같은 기록을 볼 수 있어요.
              사진 한 장은 보통 200KB 정도라 <strong className="text-foreground">4,000장 남짓</strong>{' '}
              담깁니다.
            </p>
            <p className="text-muted-foreground">
              1GB를 넘으면 넘친 사진만 올라가지 않고, <strong className="text-foreground">기기에는 그대로 남습니다.</strong>{' '}
              사진 한 장이 {formatBytes(MAX_PHOTO_BYTES)}를 넘어도 올라가지 않아요.
            </p>
            <p className="text-muted-foreground">
              용량과 상관없이 전부 보관하려면 위의{' '}
              <strong className="text-foreground">JSON 파일로 내보내기</strong>를 함께 쓰세요.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="section-title flex items-center gap-2">
        {title}
        {badge && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10.5px] font-bold text-primary">
            {badge}
          </span>
        )}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

const AUTO_OPTIONS: { value: AutoSyncMode; label: string; desc: string; Icon: typeof Wifi }[] = [
  { value: 'off', label: '자동 백업 끔', desc: '필요할 때만 [백업] 버튼으로 직접 진행', Icon: PauseCircle },
  { value: 'wifi', label: 'Wi-Fi에서만 자동 백업', desc: '데이터 사용 없이 Wi-Fi 환경에서만 자동 실행', Icon: Wifi },
  { value: 'always', label: '항상 자동 백업', desc: 'Wi-Fi와 모바일 데이터 모두에서 자동 실행', Icon: Globe },
];

function networkKindLabel(kind: NetworkKind): { text: string; tone: 'green' | 'amber' | 'gray' } {
  if (kind === 'wifi') return { text: 'Wi-Fi 또는 유선', tone: 'green' };
  if (kind === 'cellular') return { text: '셀룰러/데이터 절약', tone: 'amber' };
  return { text: '판별 불가', tone: 'gray' };
}

function AutoSyncSection({
  mode, onChange, dirty, lastAutoBackup,
}: {
  mode: AutoSyncMode;
  onChange: (next: AutoSyncMode) => void;
  dirty: boolean;
  lastAutoBackup: string | null;
}) {
  // 네트워크 종류는 라우트 진입 + online/offline 이벤트마다 갱신
  const [networkKind, setNetworkKind] = useState<NetworkKind>(() => getNetworkKind());
  useEffect(() => {
    const update = () => setNetworkKind(getNetworkKind());
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const conn: any =
      typeof navigator !== 'undefined'
        ? (navigator as any).connection ||
          (navigator as any).mozConnection ||
          (navigator as any).webkitConnection
        : null;
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', update);
    }
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      if (conn && typeof conn.removeEventListener === 'function') {
        conn.removeEventListener('change', update);
      }
    };
  }, []);

  const lastLabel = lastAutoBackup
    ? new Date(lastAutoBackup).toLocaleString('ko-KR', {
        month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : '없음';

  const netLabel = networkKindLabel(networkKind);
  const netToneClass =
    netLabel.tone === 'green'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : netLabel.tone === 'amber'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      : 'bg-muted text-muted-foreground';
  const netDotClass =
    netLabel.tone === 'green' ? 'bg-green-500' : netLabel.tone === 'amber' ? 'bg-amber-500' : 'bg-muted-foreground';

  // wifi 모드를 골랐는데 현재 환경이 wifi 가 아니거나 판별 불가면 즉시 안내 배너 노출
  const wifiBlocked = mode === 'wifi' && networkKind !== 'wifi';

  return (
    <div className="card-soft overflow-hidden bg-card">
      <div className="p-4 border-b border-border/60">
        <h3 className="text-[14px] font-bold text-foreground">자동 백업</h3>
        <p className="mt-1 text-[11.5px] text-muted-foreground leading-relaxed">
          로컬 데이터가 변경되면 자동으로 클라우드에 백업합니다.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
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
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-semibold ${netToneClass}`}
            title="브라우저가 보고하는 현재 네트워크 종류"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${netDotClass}`} />
            현재 {netLabel.text}
          </span>
          <span className="text-muted-foreground">· 마지막 자동 백업 {lastLabel}</span>
        </div>
      </div>

      {wifiBlocked && (
        <div className="border-b border-amber-200/60 bg-amber-50 px-4 py-2.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {networkKind === 'cellular'
            ? '현재 셀룰러로 잡혀 자동 백업이 일시 중단돼요. Wi-Fi 에 접속하면 다시 실행됩니다.'
            : "이 브라우저는 Wi-Fi 여부를 알려주지 않아 'Wi-Fi에서만' 모드에선 자동 백업이 건너뜁니다. 항상 자동 백업을 원하면 아래에서 '항상' 을 선택하세요."}
        </div>
      )}

      <div role="radiogroup" aria-label="자동 백업 모드" className="divide-y divide-border/60">
        {AUTO_OPTIONS.map((opt) => {
          const active = mode === opt.value;
          const isWifiOption = opt.value === 'wifi';
          const showWifiHint = isWifiOption && networkKind === 'unknown';
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
                <div className={`flex items-center gap-1.5 text-[13px] font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>
                  {opt.label}
                  {showWifiHint && (
                    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      이 브라우저 미지원
                    </span>
                  )}
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
      <div className="px-4 py-3 bg-muted/20 border-t border-border/60 space-y-1">
        <p className="text-[10.5px] text-muted-foreground leading-relaxed">
          ※ 'Wi-Fi에서만' 은 브라우저가 네트워크 종류를 알려주는 환경에서만 정확하게 동작해요.
        </p>
        <p className="text-[10.5px] text-muted-foreground leading-relaxed">
          ※ Firefox / Safari / 일부 iOS 브라우저는 정보 미제공이라 'Wi-Fi에서만' 모드에선 자동 백업이 거의 실행되지 않아요. 그런 환경에선 '항상' 또는 '끔' 을 권장해요.
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

// 동기화 확인 다이얼로그에서 항목별 수치를 보여 주는 표
interface DiffRow {
  label: string;
  a: number;
  b: number;
  same: number;
}

/** @param hideB 백업(올리기 전용)처럼 두 번째 열이 항상 0 일 때 감춘다 */
function DiffTable({
  rows,
  aLabel,
  bLabel,
  hideB,
}: {
  rows: DiffRow[];
  aLabel: string;
  bLabel: string;
  hideB?: boolean;
}) {
  return (
    <div className="mt-1 space-y-1.5">
      <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>항목</span>
        <span className="flex gap-3 tabular-nums">
          <span className="w-12 text-right">{aLabel}</span>
          {!hideB && <span className="w-12 text-right">{bLabel}</span>}
          <span className="w-12 text-right">변경없음</span>
        </span>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between text-[12px]">
          <span className="font-medium text-foreground">{r.label}</span>
          <span className="flex gap-3 tabular-nums">
            <span className={`w-12 text-right ${r.a > 0 ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{r.a}</span>
            {!hideB && (
              <span className={`w-12 text-right ${r.b > 0 ? 'font-semibold text-accent-foreground' : 'text-muted-foreground'}`}>{r.b}</span>
            )}
            <span className="w-12 text-right text-muted-foreground">{r.same}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
