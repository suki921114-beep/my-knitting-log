import { useRef } from 'react';
import { ImagePlus, Camera, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { fileToCompressedDataUrl, estimateDataUrlBytes, formatBytes } from '@/lib/image';
import { toast } from '@/components/ui/sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// 단일 이미지(라이브러리 대표 사진 등)
// TARGET: 압축이 목표로 삼는 크기 / HARD_MAX: 이걸 넘으면 저장 거부
const SINGLE_TARGET_BYTES = 500 * 1024; // 500KB
const SINGLE_HARD_MAX_BYTES = 2 * 1024 * 1024; // 2MB

interface SingleProps {
  value?: string;
  onChange: (v: string | undefined) => void;
  label?: string;
  aspect?: 'square' | 'video';
}

export function ImageInput({ value, onChange, label = '대표 이미지', aspect = 'square' }: SingleProps) {
  const ref = useRef<HTMLInputElement>(null);
  // 카메라로 바로 가는 입력은 따로 둔다.
  // 같은 입력에 capture 를 붙이면 앨범에서 고르는 길이 막힌다.
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function handle(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, {
        maxDim: 1024,
        quality: 0.8,
        maxBytes: SINGLE_TARGET_BYTES,
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
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
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
          <PhotoSourcePicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onCamera={() => cameraRef.current?.click()}
            onAlbum={() => ref.current?.click()}
          >
            <button
              type="button"
              className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow"
            >
              변경
            </button>
          </PhotoSourcePicker>
        </div>
      ) : (
        <PhotoSourcePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onCamera={() => cameraRef.current?.click()}
          onAlbum={() => ref.current?.click()}
        >
          <button
            type="button"
            className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-primary ${
              aspect === 'square' ? 'aspect-square' : 'aspect-video'
            }`}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span className="text-xs">{label} 추가</span>
          </button>
        </PhotoSourcePicker>
      )}
    </div>
  );
}

/**
 * 사진을 어디서 가져올지 고르는 자리.
 *
 * 카메라와 앨범 버튼을 나란히 놓지 않고 하나로 묶는다. 사진이 아직 없을 때
 * 버튼이 둘이면 화면이 어수선하고, 넣는 자리가 어디인지 한눈에 안 들어온다.
 */
function PhotoSourcePicker({
  open, onOpenChange, onCamera, onAlbum, children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCamera: () => void;
  onAlbum: () => void;
  children: React.ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="center" className="w-44 p-1.5">
        <button
          type="button"
          onClick={() => { onOpenChange(false); onCamera(); }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-foreground hover:bg-secondary"
        >
          <Camera className="h-4 w-4 text-primary" /> 사진 찍기
        </button>
        <button
          type="button"
          onClick={() => { onOpenChange(false); onAlbum(); }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-foreground hover:bg-secondary"
        >
          <ImagePlus className="h-4 w-4 text-primary" /> 앨범에서 고르기
        </button>
      </PopoverContent>
    </Popover>
  );
}

interface MultiProps {
  values: string[];
  onChange: (v: string[]) => void;
  max?: number;
}

// 프로젝트 사진 한 장
const MULTI_TARGET_BYTES = 400 * 1024; // 400KB
const MULTI_HARD_MAX_BYTES = 1.5 * 1024 * 1024; // 1.5MB

export function MultiImageInput({ values, onChange, max = 12 }: MultiProps) {
  const ref = useRef<HTMLInputElement>(null);
  // 카메라를 바로 여는 입력은 따로 둔다.
  // 같은 입력에 capture 를 붙이면 갤러리에서 고르는 길이 막힌다 —
  // 뜨다가 바로 찍고 싶을 때도 있고, 예전 사진을 고르고 싶을 때도 있다.
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

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
            maxBytes: MULTI_TARGET_BYTES,
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
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
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
          <PhotoSourcePicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onCamera={() => cameraRef.current?.click()}
            onAlbum={() => ref.current?.click()}
          >
            <button
              type="button"
              aria-label="사진 넣기"
              className="flex aspect-square items-center justify-center rounded-xl border border-dashed bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-primary"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            </button>
          </PhotoSourcePicker>
        )}
      </div>
    </div>
  );
}
