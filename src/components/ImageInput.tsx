import { useRef } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { fileToCompressedDataUrl, estimateDataUrlBytes, formatBytes } from '@/lib/image';
import { toast } from '@/components/ui/sonner';

// 단일 이미지(라이브러리 대표 사진 등) 압축 후 허용 최대 바이트
const SINGLE_HARD_MAX_BYTES = 2 * 1024 * 1024; // 2MB

interface SingleProps {
  value?: string;
  onChange: (v: string | undefined) => void;
  label?: string;
  aspect?: 'square' | 'video';
}

export function ImageInput({ value, onChange, label = '대표 이미지', aspect = 'square' }: SingleProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, {
        maxDim: 1024,
        quality: 0.8,
        maxBytes: SINGLE_HARD_MAX_BYTES,
      });
      if (!dataUrl) {
        toast.error('이미지를 읽지 못했어요', {
          description: 'HEIC/HEIF 같은 일부 형식은 지원되지 않을 수 있어요.',
        });
        return;
      }
      const bytes = estimateDataUrlBytes(dataUrl);
      if (bytes > SINGLE_HARD_MAX_BYTES) {
        toast.warning('이미지가 너무 커요', {
          description: `압축 후에도 ${formatBytes(bytes)} — 더 작은 사진을 선택해 주세요.`,
        });
        return;
      }
      onChange(dataUrl);
    } catch (e) {
      console.error('[ImageInput] 압축 실패:', e);
      toast.error('이미지 처리 실패', {
        description: '다른 사진으로 다시 시도해 주세요.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          handle(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {value ? (
        <div className={`relative overflow-hidden rounded-2xl border bg-muted ${aspect === 'square' ? 'aspect-square' : 'aspect-video'}`}>
          <img src={value} alt={label} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-foreground shadow"
            aria-label="이미지 제거"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow"
          >
            변경
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-primary ${
            aspect === 'square' ? 'aspect-square' : 'aspect-video'
          }`}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-xs">{label} 추가</span>
        </button>
      )}
    </div>
  );
}

interface MultiProps {
  values: string[];
  onChange: (v: string[]) => void;
  max?: number;
}

// 프로젝트 사진 한 장 압축 후 허용 최대 바이트
const MULTI_HARD_MAX_BYTES = 1.5 * 1024 * 1024; // 1.5MB

export function MultiImageInput({ values, onChange, max = 12 }: MultiProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const slots = Math.max(0, max - values.length);
      const list = Array.from(files).slice(0, slots);
      const out: string[] = [];
      let skippedFormat = 0;
      let skippedSize = 0;
      for (const f of list) {
        try {
          const dataUrl = await fileToCompressedDataUrl(f, {
            maxDim: 1280,
            quality: 0.8,
            maxBytes: MULTI_HARD_MAX_BYTES,
          });
          if (!dataUrl) {
            skippedFormat++;
            continue;
          }
          if (estimateDataUrlBytes(dataUrl) > MULTI_HARD_MAX_BYTES) {
            skippedSize++;
            continue;
          }
          out.push(dataUrl);
        } catch (e) {
          console.error('[MultiImageInput] 압축 실패:', f.name, e);
          skippedFormat++;
        }
      }
      if (out.length) {
        onChange([...values, ...out]);
      }
      if (skippedFormat > 0) {
        toast.error(`사진 ${skippedFormat}장을 읽지 못했어요`, {
          description: 'HEIC/HEIF 같은 일부 형식은 지원되지 않을 수 있어요.',
        });
      }
      if (skippedSize > 0) {
        toast.warning(`사진 ${skippedSize}장이 너무 커요`, {
          description: '압축 후에도 1.5MB 를 초과해 저장에서 제외했어요.',
        });
      }
      if (files.length > slots) {
        toast.message(`최대 ${max}장까지 저장할 수 있어요`, {
          description: `${files.length - slots}장은 추가하지 못했어요.`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  function removeAt(i: number) {
    onChange(values.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => {
          handle(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="grid grid-cols-3 gap-2">
        {values.map((src, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
            <img src={src} alt={`사진 ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground shadow"
              aria-label="사진 삭제"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {values.length < max && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="flex aspect-square items-center justify-center rounded-xl border border-dashed bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-primary"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
