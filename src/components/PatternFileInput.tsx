// ----------------------------------------------------------------------------
// 도안 PDF 붙이기
// ----------------------------------------------------------------------------
// 고른 파일을 곧바로 저장하지 않고 들고만 있다가, 도안을 저장할 때 함께 넣는다.
// 이유가 둘이다.
//   · 새 도안은 아직 id 가 없다. 저장돼야 '어느 도안의 파일' 인지 적을 수 있다.
//   · 잘못 골랐을 때 화면을 나가면 그냥 없던 일이 된다.
//
// 상태가 셋이다.
//   pending === undefined → 저장돼 있는 그대로
//   pending === null      → 지우기로 표시해 둠
//   pending === File      → 새로 고른 파일 (아직 저장 전)

import { useRef, useState } from 'react';
import { FileText, Trash2, Eye, Download, Paperclip, Cloud, CloudOff } from 'lucide-react';
import { canSyncPatternFiles } from '@/lib/sync/patternFileSync';
import PdfViewer from '@/components/PdfViewer';
import type { PatternFile } from '@/lib/db';
import {
  ACCEPTED_PATTERN_FILE_TYPES,
  MAX_PATTERN_FILE_BYTES,
  formatBytes,
  isPdf,
  saveErrorMessage,
} from '@/lib/patternFile';
import { toast } from '@/components/ui/sonner';

export type PendingPatternFile = File | null | undefined;

interface Props {
  /** 저장돼 있는 파일 */
  saved?: PatternFile;
  pending: PendingPatternFile;
  onPending: (p: PendingPatternFile) => void;
  /** 보던 자리를 기억할 열쇠 — 도안 id */
  rememberKey?: string;
}

export default function PatternFileInput({ saved, pending, onPending, rememberKey }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState(false);
  const cloudEnabled = canSyncPatternFiles();

  // 지금 화면에 보여줄 파일. 새로 고른 게 있으면 그것이 이긴다.
  const shown: { name: string; size: number; blob: Blob; isNew: boolean } | null =
    pending instanceof File
      ? { name: pending.name, size: pending.size, blob: pending, isNew: true }
      : pending === null
        ? null
        : saved
          ? { name: saved.name, size: saved.size, blob: saved.blob, isNew: false }
          : null;

  function pick(file?: File) {
    if (!file) return;
    if (!isPdf(file)) {
      const m = saveErrorMessage('type');
      toast.error(m.title, { description: m.description });
      return;
    }
    if (file.size > MAX_PATTERN_FILE_BYTES) {
      const m = saveErrorMessage('size');
      toast.error(m.title, { description: m.description });
      return;
    }
    onPending(file);
  }

  function download() {
    if (!shown) return;
    const url = URL.createObjectURL(shown.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = shown.name || '도안.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_PATTERN_FILE_TYPES}
        className="hidden"
        onChange={e => {
          pick(e.target.files?.[0]);
          // 같은 파일을 다시 골라도 열리도록 비워 둔다
          e.target.value = '';
        }}
      />

      {shown ? (
        <div className="card-soft p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-ink">{shown.name}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>{formatBytes(shown.size)}</span>
                {shown.isNew ? (
                  <span className="font-semibold text-primary">저장하면 반영돼요</span>
                ) : cloudEnabled && (
                  // 올라갔는지 아닌지를 보여준다. '백업했으니 괜찮겠지' 하고
                  // 넘어갔다가 안 올라가 있으면 기기를 바꿀 때 잃는다.
                  <span className="inline-flex items-center gap-1 font-semibold">
                    {saved?.storagePath ? (
                      <>
                        <Cloud className="h-3 w-3 text-primary" />
                        <span className="text-primary">클라우드에 있어요</span>
                      </>
                    ) : (
                      <>
                        <CloudOff className="h-3 w-3" />
                        <span>백업하면 올라가요</span>
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onPending(null)}
              aria-label="도안 파일 빼기"
              className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2.5 flex gap-1.5">
            <button
              type="button"
              onClick={() => setViewing(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-2 text-[12.5px] font-semibold text-primary-foreground"
            >
              <Eye className="h-3.5 w-3.5" /> 도안 보기
            </button>
            <button
              type="button"
              onClick={download}
              className="flex items-center justify-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground"
            >
              <Download className="h-3.5 w-3.5" /> 내려받기
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground"
            >
              교체
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-4 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft/40 hover:text-primary"
        >
          <Paperclip className="h-4 w-4" /> PDF 도안 넣기
        </button>
      )}

      {/* 이 안내는 접어두지 않는다. 도안은 돈 주고 산 파일이라 사라지면
          사진과는 이야기가 다르다 — 처음 넣을 때 꼭 읽고 넘어가야 한다. */}
      {/* 안내는 계정에 따라 다르게 말해야 한다.
          클라우드가 열린 계정에 "이 기기에만 저장된다" 고 하면 거짓말이고,
          안 열린 계정에 "백업된다" 고 하면 파일을 잃게 만든다. */}
      {cloudEnabled ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          ※ 도안 파일은 <strong className="text-foreground">백업할 때 클라우드에 함께 올라가요.</strong>{' '}
          다른 기기에서는 가져오기를 하면 받아집니다. 파일로 내보내기에는 담기지 않아요.
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          ※ 도안 파일은 이 기기에만 저장돼요. 백업에는 담기지 않아서 <strong className="text-foreground">다른
          기기에서 넣은 도안은 여기 보이지 않아요.</strong> 원본은 따로 보관해 주세요.
        </p>
      )}

      {viewing && shown && (
        <PdfViewer
          file={{
            patternId: 0,
            name: shown.name,
            size: shown.size,
            type: 'application/pdf',
            blob: shown.blob,
            createdAt: 0,
          }}
          rememberKey={shown.isNew ? undefined : rememberKey}
          onClose={() => setViewing(false)}
        />
      )}
    </div>
  );
}
