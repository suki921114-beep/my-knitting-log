import { useRef } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { fileToCompressedDataUrl } from '@/lib/image';

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
      const dataUrl = await fileToCompressedDataUrl(file, { maxDim: 1024, quality: 0.8 });
      onChange(dataUrl);
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
      for (const f of list) {
        out.push(await fileToCompressedDataUrl(f, { maxDim: 1280, quality: 0.82 }));
      }
      onChange([...values, ...out]);
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
