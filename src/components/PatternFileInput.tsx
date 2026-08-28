// ----------------------------------------------------------------------------
// 도안 PDF 붙이기
// ----------------------------------------------------------------------------
// 도안 하나에 파일이 여럿 올 수 있다 — 본문 따로, 차트 따로, 사이즈별 옵션 따로.
// 그래서 최대 3장까지 담는다.
//
// 고른 파일을 곧바로 저장하지 않고 들고만 있다가, 도안을 저장할 때 함께 넣는다.
//   · 새 도안은 아직 id 가 없다. 저장돼야 '어느 도안의 파일' 인지 적을 수 있다.
//   · 잘못 골랐을 때 화면을 나가면 그냥 없던 일이 된다.

import { useRef, useState } from 'react';
import { FileText, Trash2, Eye, Download, Paperclip, Cloud, CloudOff } from 'lucide-react';
import PdfViewer from '@/components/PdfViewer';
import { canSyncPatternFiles } from '@/lib/sync/patternFileSync';
import type { PatternFile } from '@/lib/db';
import {
  ACCEPTED_PATTERN_FILE_TYPES,
  MAX_PATTERN_FILE_BYTES,
  MAX_PATTERN_FILES,
  formatBytes,
  isPdf,
  saveErrorMessage,
} from '@/lib/patternFile';
import { toast } from '@/components/ui/sonner';

/** 저장을 눌러야 반영되는 변경 목록 */
export interface PendingFiles {
  /** 새로 고른 파일들 */
  added: File[];
  /** 빼기로 한, 이미 저장된 파일의 id */
  removed: number[];
}

export const EMPTY_PENDING: PendingFiles = { added: [], removed: [] };

interface Props {
  saved: PatternFile[];
  pending: PendingFiles;
  onPending: (p: PendingFiles) => void;
  /** 보던 자리를 기억할 열쇠 — 도안 id */
  rememberKey?: string;
}

/** 화면에 한 줄로 보여줄 모양 — 저장된 것과 새로 고른 것을 같이 다룬다 */
interface Row {
  key: string;
  name: string;
  size: number;
  blob: Blob;
  isNew: boolean;
  savedId?: number;
  storagePath?: string;
}

export default function PatternFileInput({ saved, pending, onPending, rememberKey }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const cloudEnabled = canSyncPatternFiles();

  const rows: Row[] = [
    ...saved
      .filter(f => !pending.removed.includes(f.id!))
      .map(f => ({
        key: `s${f.id}`, name: f.name, size: f.size, blob: f.blob,
        isNew: false, savedId: f.id, storagePath: f.storagePath,
      })),
    ...pending.added.map((f, i) => ({
      key: `n${i}`, name: f.name, size: f.size, blob: f, isNew: true,
    })),
  ];
  const full = rows.length >= MAX_PATTERN_FILES;

  function pick(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PATTERN_FILES - rows.length;
    if (room <= 0) {
      const m = saveErrorMessage('limit');
      toast.error(m.title, { description: m.description });
      return;
    }
    const ok: File[] = [];
    for (const f of Array.from(files)) {
      if (ok.length >= room) {
        toast.warning(`${MAX_PATTERN_FILES}개까지만 담을 수 있어요`);
        break;
      }
      if (!isPdf(f)) { const m = saveErrorMessage('type'); toast.error(m.title, { description: m.description }); continue; }
      if (f.size > MAX_PATTERN_FILE_BYTES) { const m = saveErrorMessage('size'); toast.error(m.title, { description: m.description }); continue; }
      ok.push(f);
    }
    if (ok.length) onPending({ ...pending, added: [...pending.added, ...ok] });
  }

  function remove(r: Row) {
    if (r.savedId != null) onPending({ ...pending, removed: [...pending.removed, r.savedId] });
    else onPending({ ...pending, added: pending.added.filter(f => f !== r.blob) });
  }

  function download(r: Row) {
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement('a');
    a.href = url; a.download = r.name || '도안.pdf'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_PATTERN_FILE_TYPES}
        multiple
        className="hidden"
        onChange={e => { pick(e.target.files); e.target.value = ''; }}
      />

      {rows.map((r, i) => (
        <div key={r.key} className="card-soft p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-ink">{r.name}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>{formatBytes(r.size)}</span>
                {r.isNew ? (
                  <span className="font-semibold text-primary">저장하면 반영돼요</span>
                ) : cloudEnabled && (
                  <span className="inline-flex items-center gap-1 font-semibold">
                    {r.storagePath ? (
                      <><Cloud className="h-3 w-3 text-primary" /><span className="text-primary">클라우드에 있어요</span></>
                    ) : (
                      <><CloudOff className="h-3 w-3" /><span>백업하면 올라가요</span></>
                    )}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(r)}
              aria-label={`${r.name} 빼기`}
              className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2.5 flex gap-1.5">
            <button
              type="button"
              onClick={() => setViewing(i)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-2 text-[12.5px] font-semibold text-primary-foreground"
            >
              <Eye className="h-3.5 w-3.5" /> 도안 보기
            </button>
            <button
              type="button"
              onClick={() => download(r)}
              className="flex items-center justify-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground"
            >
              <Download className="h-3.5 w-3.5" /> 내려받기
            </button>
          </div>
        </div>
      ))}

      {!full && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-4 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft/40 hover:text-primary"
        >
          <Paperclip className="h-4 w-4" />
          {rows.length === 0 ? 'PDF 도안 넣기' : `도안 더 넣기 (${rows.length}/${MAX_PATTERN_FILES})`}
        </button>
      )}

      {/* 안내는 계정에 따라 다르게 말해야 한다.
          클라우드가 열린 계정에 "이 기기에만 저장된다" 고 하면 거짓말이고,
          안 열린 계정에 "백업된다" 고 하면 파일을 잃게 만든다. */}
      {cloudEnabled ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          ※ 차트나 사이즈별 도안처럼 파일이 여럿이면 {MAX_PATTERN_FILES}개까지 넣을 수 있어요.
          도안 파일은 <strong className="text-foreground">백업할 때 클라우드에 함께 올라가요.</strong>{' '}
          파일로 내보내기에는 담기지 않아요.
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          ※ 차트나 사이즈별 도안처럼 파일이 여럿이면 {MAX_PATTERN_FILES}개까지 넣을 수 있어요.
          도안 파일은 이 기기에만 저장돼서 <strong className="text-foreground">다른 기기에서 넣은 도안은
          여기 보이지 않아요.</strong> 원본은 따로 보관해 주세요.
        </p>
      )}

      {viewing !== null && rows[viewing] && (
        <PdfViewer
          files={rows.map(r => ({
            patternId: 0, name: r.name, size: r.size,
            type: 'application/pdf', blob: r.blob, createdAt: 0,
          }))}
          index={viewing}
          onIndexChange={setViewing}
          rememberKey={rows[viewing].isNew ? undefined : rememberKey}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
