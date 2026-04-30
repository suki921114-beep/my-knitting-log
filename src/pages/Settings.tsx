import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { db, exportAll, importAll, clearAll } from '@/lib/db';
import { Download, Upload, Trash2, ShieldCheck, ChevronRight, UserCircle2, LogOut, LogIn, Loader2, CloudDownload } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/hooks/useAuth';
import { calculateYarnSyncDiff, executeYarnSync, calculateYarnFetchDiff, executeYarnFetch, calculatePatternSyncDiff, executePatternSync, calculatePatternFetchDiff, executePatternFetch } from '@/lib/sync';

export default function Settings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const handleFetch = async () => {
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }
    
    setIsFetching(true);
    try {
      const yarnDiff = await calculateYarnFetchDiff(user.uid);
      const patternDiff = await calculatePatternFetchDiff(user.uid);
      
      const confirmMsg = `클라우드에서 가져오기:\n\n[실]\n- 추가: ${yarnDiff.toAdd.length}건 / 업데이트: ${yarnDiff.toUpdate.length}건 / 변경 없음: ${yarnDiff.unchanged}건\n[도안]\n- 추가: ${patternDiff.toAdd.length}건 / 업데이트: ${patternDiff.toUpdate.length}건 / 변경 없음: ${patternDiff.unchanged}건\n\n이 기기로 데이터를 가져오시겠습니까?`;
      
      if (!confirm(confirmMsg)) {
        setIsFetching(false);
        return;
      }
      
      const yarnResult = await executeYarnFetch(yarnDiff);
      const patternResult = await executePatternFetch(patternDiff);
      
      const failed = yarnResult.failed + patternResult.failed;
      const alertTitle = failed > 0 ? "일부 항목 가져오기 실패" : "가져오기 완료!";
      
      alert(`${alertTitle}\n\n[실]\n- 추가: ${yarnResult.added}건 / 업데이트: ${yarnResult.updated}건 / 변경 없음: ${yarnResult.unchanged}건\n[도안]\n- 추가: ${patternResult.added}건 / 업데이트: ${patternResult.updated}건 / 변경 없음: ${patternResult.unchanged}건`);
    } catch (error) {
      alert("가져오기 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      console.error(error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSync = async () => {
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }
    
    setIsSyncing(true);
    try {
      const yarnDiff = await calculateYarnSyncDiff(user.uid);
      const patternDiff = await calculatePatternSyncDiff(user.uid);
      
      const confirmMsg = `동기화 대상 확인:\n\n[실]\n- 업로드: ${yarnDiff.toUpload.length}건 / 다운로드: ${yarnDiff.toDownload.length}건 / 변경 없음: ${yarnDiff.unchanged}건\n[도안]\n- 업로드: ${patternDiff.toUpload.length}건 / 다운로드: ${patternDiff.toDownload.length}건 / 변경 없음: ${patternDiff.unchanged}건\n\n지금 동기화를 진행하시겠습니까?`;
      
      if (!confirm(confirmMsg)) {
        setIsSyncing(false);
        return;
      }
      
      const yarnResult = await executeYarnSync(user.uid, yarnDiff);
      const patternResult = await executePatternSync(user.uid, patternDiff);
      
      const failed = yarnResult.failed + patternResult.failed;
      const alertTitle = failed > 0 ? "일부 항목 동기화 실패" : "동기화 완료!";
      
      alert(`${alertTitle}\n\n[실]\n- 업로드: ${yarnResult.uploaded}건 / 다운로드: ${yarnResult.downloaded}건 / 변경 없음: ${yarnResult.unchanged}건\n[도안]\n- 업로드: ${patternResult.uploaded}건 / 다운로드: ${patternResult.downloaded}건 / 변경 없음: ${patternResult.unchanged}건`);
    } catch (error) {
      alert("동기화 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    setLastBackup(localStorage.getItem('lastBackupAt'));
  }, []);

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
      alert('가져오기 완료');
    } catch (e: any) {
      alert('가져오기 실패: ' + e.message);
    } finally {
      setBusy(false);
    }
  }
  
  async function handleClear() {
    if (!confirm('정말 모든 데이터를 삭제할까요?')) return;
    if (!confirm('되돌릴 수 없습니다. 계속할까요?')) return;
    await clearAll();
    alert('삭제 완료');
  }

  const lastBackupLabel = lastBackup
    ? new Date(lastBackup).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
    : '없음';

  return (
    <div className="space-y-6">
      <PageHeader title="설정" />

      {/* 1. 계정 섹션 추가 */}
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

            {/* 동기화 안내 배너 (준비 상태) */}
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
                      "병합/올리기"
                    )}
                  </button>
                </div>
              </div>
            </div>
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

      {/* 2. 기존 데이터 관리 섹션 */}
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
        <input ref={fileRef} type="file" accept="application/json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />
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
