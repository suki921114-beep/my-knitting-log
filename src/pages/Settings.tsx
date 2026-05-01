import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { db, exportAll, importAll, clearAll } from '@/lib/db';
import {
  Download,
  Upload,
  Trash2,
  ShieldCheck,
  ChevronRight,
  UserCircle2,
  LogOut,
  LogIn,
  Loader2,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/sonner';
import {
  calculateYarnSyncDiff,
  executeYarnSync,
  calculateYarnFetchDiff,
  executeYarnFetch,
  calculatePatternSyncDiff,
  executePatternSync,
  calculatePatternFetchDiff,
  executePatternFetch,
  calculateNeedleSyncDiff,
  executeNeedleSync,
  calculateNeedleFetchDiff,
  executeNeedleFetch,
  calculateNotionSyncDiff,
  executeNotionSync,
  calculateNotionFetchDiff,
  executeNotionFetch,
  calculateProjectSyncDiff,
  executeProjectSync,
  calculateProjectFetchDiff,
  executeProjectFetch,
} from '@/lib/sync';

// ----------------------------------------------------------------------------
// 결과 요약용 타입
// ----------------------------------------------------------------------------

type EntitySyncStat = {
  uploaded: number;
  downloaded: number;
  unchanged: number;
  failed: number;
};

type EntityFetchStat = {
  added: number;
  updated: number;
  unchanged: number;
  failed: number;
};

type LastResult =
  | {
      mode: 'sync';
      at: string;
      entries: { label: string; stat: EntitySyncStat }[];
    }
  | {
      mode: 'fetch';
      at: string;
      entries: { label: string; stat: EntityFetchStat }[];
    };

const LAST_RESULT_KEY = 'lastSyncResult.v1';

// ----------------------------------------------------------------------------
// 토스트 라벨 도우미
// ----------------------------------------------------------------------------

function syncToastDetail(stat: EntitySyncStat) {
  const parts = [
    `↑ ${stat.uploaded}`,
    `↓ ${stat.downloaded}`,
    `· ${stat.unchanged}`,
  ];
  if (stat.failed > 0) parts.push(`× ${stat.failed}`);
  return parts.join(' / ');
}

function fetchToastDetail(stat: EntityFetchStat) {
  const parts = [
    `+ ${stat.added}`,
    `↻ ${stat.updated}`,
    `· ${stat.unchanged}`,
  ];
  if (stat.failed > 0) parts.push(`× ${stat.failed}`);
  return parts.join(' / ');
}

export default function Settings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  // 페이지 로드 시 마지막 결과 복원
  useEffect(() => {
    setLastBackup(localStorage.getItem('lastBackupAt'));
    const raw = localStorage.getItem(LAST_RESULT_KEY);
    if (raw) {
      try {
        setLastResult(JSON.parse(raw) as LastResult);
      } catch {
        // ignore
      }
    }
  }, []);

  function persistResult(result: LastResult) {
    setLastResult(result);
    try {
      localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(result));
    } catch {
      // localStorage 가득 찼거나 비공개 모드일 수 있음 — 무시
    }
  }

  // --------------------------------------------------------------------------
  // 가져오기 (클라우드 → 로컬)
  // --------------------------------------------------------------------------
  const handleFetch = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
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

      // 단계별 실행 + 토스트
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
        yarnResult.failed +
        patternResult.failed +
        needleResult.failed +
        notionResult.failed +
        projectResult.failed;

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
      toast.error('가져오기 중 오류가 발생했습니다', {
        id: tid,
        description: '잠시 후 다시 시도해주세요.',
      });
    } finally {
      setIsFetching(false);
    }
  };

  // --------------------------------------------------------------------------
  // 동기화 (로컬 ↔ 클라우드 양방향)
  // --------------------------------------------------------------------------
  const handleSync = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    setIsSyncing(true);
    const tid = 'sync-progress';
    try {
      toast.loading('동기화 대상 분석 중…', { id: tid });

      const yarnDiff = await calculateYarnSyncDiff(user.uid);
      const patternDiff = await calculatePatternSyncDiff(user.uid);
      const needleDiff = await calculateNeedleSyncDiff(user.uid);
      const notionDiff = await calculateNotionSyncDiff(user.uid);
      const projectDiff = await calculateProjectSyncDiff(user.uid);

      toast.dismiss(tid);

      const confirmMsg =
        '동기화 대상 확인:\n\n' +
        `[실] 업로드 ${yarnDiff.toUpload.length} / 다운로드 ${yarnDiff.toDownload.length} / 변경없음 ${yarnDiff.unchanged}\n` +
        `[도안] 업로드 ${patternDiff.toUpload.length} / 다운로드 ${patternDiff.toDownload.length} / 변경없음 ${patternDiff.unchanged}\n` +
        `[바늘] 업로드 ${needleDiff.toUpload.length} / 다운로드 ${needleDiff.toDownload.length} / 변경없음 ${needleDiff.unchanged}\n` +
        `[부자재] 업로드 ${notionDiff.toUpload.length} / 다운로드 ${notionDiff.toDownload.length} / 변경없음 ${notionDiff.unchanged}\n` +
        `[프로젝트] 업로드 ${projectDiff.toUpload.length} / 다운로드 ${projectDiff.toDownload.length} / 변경없음 ${projectDiff.unchanged}\n\n` +
        '지금 동기화를 진행하시겠습니까?';

      if (!confirm(confirmMsg)) {
        setIsSyncing(false);
        return;
      }

      // entity별로 토스트 한 번씩
      toast.loading('실 동기화 중…', { id: tid });
      const yarnResult = await executeYarnSync(user.uid, yarnDiff);
      toast.success(`실 동기화 완료 · ${syncToastDetail(yarnResult)}`, { id: tid });

      const ptid = 'sync-pattern';
      toast.loading('도안 동기화 중…', { id: ptid });
      const patternResult = await executePatternSync(user.uid, patternDiff);
      toast.success(`도안 동기화 완료 · ${syncToastDetail(patternResult)}`, { id: ptid });

      const ntid = 'sync-needle';
      toast.loading('바늘 동기화 중…', { id: ntid });
      const needleResult = await executeNeedleSync(user.uid, needleDiff);
      toast.success(`바늘 동기화 완료 · ${syncToastDetail(needleResult)}`, { id: ntid });

      const notid = 'sync-notion';
      toast.loading('부자재 동기화 중…', { id: notid });
      const notionResult = await executeNotionSync(user.uid, notionDiff);
      toast.success(`부자재 동기화 완료 · ${syncToastDetail(notionResult)}`, { id: notid });

      const prtid = 'sync-project';
      toast.loading('프로젝트(연결관계·카운터·게이지) 동기화 중…', { id: prtid });
      const projectResult = await executeProjectSync(user.uid, projectDiff);
      toast.success(`프로젝트 동기화 완료 · ${syncToastDetail(projectResult)}`, { id: prtid });

      const failedTotal =
        yarnResult.failed +
        patternResult.failed +
        needleResult.failed +
        notionResult.failed +
        projectResult.failed;

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

      if (failedTotal > 0) {
        toast.warning(`동기화 완료 · 실패 ${failedTotal}건`, {
          description: '아래 결과 카드를 확인하세요.',
        });
      } else {
        toast.success('동기화 완료', {
          description: '아래 결과 카드에서 항목별 수치를 확인할 수 있어요.',
        });
      }
    } catch (error) {
      console.error(error);
      toast.error('동기화 중 오류가 발생했습니다', {
        id: tid,
        description: '잠시 후 다시 시도해주세요.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const totals = useLiveQuery(async () => ({
    p: await db.projects.count(),
    y: await db.yarns.count(),
    pat: await db.patterns.count(),
    n: await db.needles.count(),
    no: await db.notions.count(),
  }), []) || { p: 0, y: 0, pat: 0, n: 0, no: 0 };

  const totalItems = totals.p + totals.y + totals.pat + totals.n + totals.no;

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
      setLastBackup(now);
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

  async function handleClear() {
    if (!confirm('정말 모든 데이터를 삭제할까요?')) return;
    if (!confirm('되돌릴 수 없습니다. 계속할까요?')) return;
    await clearAll();
    toast.success('전체 데이터가 삭제되었습니다');
  }

  const lastBackupLabel = lastBackup
    ? new Date(lastBackup).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
    : '없음';

  return (
    <div className="space-y-6">
      <PageHeader title="설정" />

      {/* 1. 계정 섹션 */}
      <Section title="계정">
        {user ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="card-soft overflow-hidden">
              <div className="flex items-center gap-4 p-4 border-b border-border/60 bg-card">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="h-12 w-12 rounded-full object-cover shadow-sm" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <UserCircle2 className="h-7 w-7" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-[14px] font-bold text-foreground truncate">{user.displayName || '사용자'}</div>
                    <span className="rounded-md bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 text-[9px] font-bold text-green-700 dark:text-green-400">연결됨</span>
                  </div>
                  <div className="text-[11.5px] text-muted-foreground truncate mt-0.5">{user.email}</div>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (confirm('로그아웃 하시겠습니까?')) {
                    await logout();
                  }
                }}
                className="flex w-full items-center gap-3 p-4 transition-colors active:bg-muted/50 hover:bg-muted/30"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <LogOut className="h-4 w-4" />
                </span>
                <div className="text-[13.5px] font-semibold text-foreground text-left flex-1">로그아웃</div>
              </button>
            </div>

            {/* 동기화 안내 + 액션 */}
            <div className="card-soft overflow-hidden border-primary/20 bg-primary/5">
              <div className="p-4">
                <h3 className="text-[14px] font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  클라우드 연결 준비 완료
                </h3>
                <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">
                  이 기기에 저장된 <strong>{totalItems}개</strong>의 뜨개 기록을 내 계정에 안전하게 동기화하시겠습니까?
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleFetch}
                    disabled={isFetching || isSyncing}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-[13px] font-semibold text-accent-foreground shadow-sm transition-all active:scale-[0.98] hover:bg-accent/90 disabled:opacity-60"
                  >
                    {isFetching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CloudDownload className="h-4 w-4" />
                    )}
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
                    ) : (
                      '병합/올리기'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 마지막 동기화 결과 카드 */}
            {lastResult && <LastResultCard result={lastResult} />}
          </div>
        ) : (
          <div className="card-soft overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-4 p-4 border-b border-border/60 bg-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <UserCircle2 className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[14px] font-bold text-foreground">게스트 모드</div>
                  <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-secondary-foreground tracking-wide">OFFLINE</span>
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">데이터를 동기화하려면 로그인하세요</div>
              </div>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="flex w-full items-center gap-3 p-4 transition-colors active:bg-muted/50 hover:bg-muted/30"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LogIn className="h-4 w-4" />
              </span>
              <div className="flex-1 text-left text-[13.5px] font-semibold text-foreground">계정 연결 (로그인)</div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </Section>

      {/* 2. 데이터 관리 */}
      <Section title="데이터 관리">
        <div className="card-soft p-4 bg-card">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-foreground">로컬 저장</div>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">현재 모든 기록은 이 기기에 안전하게 보관 중입니다.</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
            <Meta label="저장된 항목" value={`${totalItems}개`} />
            <Meta label="마지막 백업" value={lastBackupLabel} />
          </dl>
        </div>
      </Section>

      <Section title="백업">
        <button
          onClick={handleExport}
          disabled={busy}
          className="card-soft flex w-full items-center gap-3 p-4 transition active:scale-[0.99] hover:shadow-soft disabled:opacity-60 bg-card"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Download className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[13.5px] font-semibold text-foreground">내보내기</div>
            <div className="text-[11.5px] text-muted-foreground">JSON 파일로 저장</div>
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
            <div className="text-[13.5px] font-semibold text-foreground">가져오기</div>
            <div className="text-[11.5px] text-muted-foreground">JSON 파일 선택</div>
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

      <Section title="위험 영역">
        <button
          onClick={handleClear}
          className="card-danger flex w-full items-center gap-3 p-4 text-left bg-card"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Trash2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-destructive">전체 삭제</div>
            <div className="text-[11.5px] text-destructive/70">되돌릴 수 없어요</div>
          </div>
          <ChevronRight className="h-4 w-4 text-destructive/50" />
        </button>
      </Section>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 보조 컴포넌트
// ----------------------------------------------------------------------------

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-[14px] font-bold tracking-tight text-foreground tabular-nums">{value}</dd>
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

function LastResultCard({ result }: { result: LastResult }) {
  const totalFailed = result.entries.reduce((acc, e) => acc + e.stat.failed, 0);
  const at = new Date(result.at).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const title = result.mode === 'sync' ? '마지막 동기화 결과' : '마지막 가져오기 결과';

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
  label,
  stat,
  mode,
}: {
  label: string;
  stat: EntitySyncStat | EntityFetchStat;
  mode: 'sync' | 'fetch';
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
              item.tone === 'muted'
                ? 'text-muted-foreground'
                : item.tone === 'accent'
                ? 'text-accent-foreground'
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
