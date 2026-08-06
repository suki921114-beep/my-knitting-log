import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { useConfirm } from '@/hooks/useConfirm';
import { ImageInput } from '@/components/ImageInput';
import { toast } from '@/components/ui/sonner';
import { Plus, Save, Trash2 } from 'lucide-react';
import { gramsToMeters, formatMeters, yarnRecommendations } from '@/lib/yarnCalc';

export default function YarnForm() {
  const { id } = useParams();
  const yid = id ? Number(id) : undefined;
  const editing = !!yid;
  const nav = useNavigate();
  const { confirm, dialog } = useConfirm();
  const existing = useLiveQuery(() => (yid ? db.yarns.get(yid) : undefined), [yid]);

  const [f, setF] = useState({
    name: '', brand: '', colorName: '', colorCode: '', shop: '', link: '', fiber: '', weight: '',
    totalGrams: 0, metersPer100g: 0, note: '',
  });
  // 합수별 권장 바늘·게이지. 화면에서는 문자열로 다루고 저장할 때 숫자로 바꾼다.
  const [recs, setRecs] = useState<{ strands: string; needleSize: string; gauge: string }[]>([]);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [hyd, setHyd] = useState(false);

  useEffect(() => {
    if (editing && existing && !hyd) {
      setF({
        name: existing.name, brand: existing.brand || '', colorName: existing.colorName || '',
        colorCode: existing.colorCode || '', shop: existing.shop || '', link: existing.link || '',
        fiber: existing.fiber || '',
        weight: existing.weight || '',
        totalGrams: existing.totalGrams, metersPer100g: existing.metersPer100g || 0,
        note: existing.note || '',
      });
      // 예전에 한 줄로 적어둔 값도 1합으로 올라온다
      setRecs(
        yarnRecommendations(existing).map(r => ({
          strands: String(r.strands),
          needleSize: r.needleSize || '',
          gauge: r.gauge || '',
        })),
      );
      setPhoto(existing.photoDataUrl);
      setHyd(true);
    }
  }, [editing, existing, hyd]);

  function addRec() {
    // 다음 합수를 미리 채워준다 — 대개 1합 다음은 2합이다
    const next = recs.reduce((max, r) => Math.max(max, Number(r.strands) || 0), 0) + 1;
    setRecs([...recs, { strands: String(next), needleSize: '', gauge: '' }]);
  }

  function updateRec(i: number, patch: Partial<(typeof recs)[number]>) {
    setRecs(recs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRec(i: number) {
    setRecs(recs.filter((_, idx) => idx !== i));
  }

  // 삭제된 항목의 수정 화면으로 (뒤로가기 등으로) 진입하면 목록으로 되돌린다
  useEffect(() => {
    if (editing && existing?.isDeleted) {
      nav('/library/yarns', { replace: true });
    }
  }, [editing, existing, nav]);

  async function save() {
    if (!f.name.trim()) {
      toast.error('실 이름을 입력해 주세요.');
      return;
    }
    const t = now();
    
    // 공통 업데이트 필드
    // 합수가 없거나 바늘·게이지를 둘 다 비워둔 줄은 버린다
    const recommendations = recs
      .map(r => ({
        strands: Number(r.strands) || 0,
        needleSize: r.needleSize.trim() || undefined,
        gauge: r.gauge.trim() || undefined,
      }))
      .filter(r => r.strands > 0 && (r.needleSize || r.gauge))
      .sort((a, b) => a.strands - b.strands);

    const payload = {
      ...f,
      // 안 적었으면 0 이 아니라 '없음'으로 둔다. 0m/100g 인 실은 없다.
      metersPer100g: f.metersPer100g > 0 ? f.metersPer100g : undefined,
      recommendations: recommendations.length ? recommendations : undefined,
      // 예전 한 줄짜리 값은 여기서 비운다. 두 곳에 남으면 어느 쪽이 맞는지 알 수 없다.
      needleSize: undefined,
      gauge: undefined,
      photoDataUrl: photo,
      updatedAt: t,
      isDeleted: false,
      deletedAt: null
    };
    
    if (editing && yid) {
      // 수정 시 기존 createdAt, cloudId는 그대로 유지됨 (update 동작)
      await db.yarns.update(yid, payload);
      nav(`/library/yarns/${yid}`, { replace: true });
    } else {
      // 신규 생성 시 누락된 필수 필드 전부 주입
      const id = (await db.yarns.add({ 
        ...payload, 
        createdAt: t,
        cloudId: crypto.randomUUID()
      })) as number;
      nav(`/library/yarns/${id}`, { replace: true });
    }
  }

  async function remove() {
    if (!yid) return;
    const ok = await confirm({
      title: '이 실을 삭제할까요?',
      description: '프로젝트에 연결된 사용 기록은 그대로 남아요. 휴지통에서 되돌릴 수 있어요.',
      confirmLabel: '삭제',
    });
    if (!ok) return;
    const t = Date.now();
    // soft delete — 실제 row 는 보존하고 isDeleted 만 켠다.
    // 프로젝트의 연결관계(projectYarns)는 다음 단계에서 cascade 처리 예정이라 지금은 그대로 둔다.
    await db.yarns.update(yid, {
      isDeleted: true,
      deletedAt: t,
      updatedAt: t,
    } as any);
    nav('/library/yarns', { replace: true });
    toast.success('실을 삭제했어요', {
      duration: 8000,
      action: {
        label: '되돌리기',
        onClick: async () => {
          const now = Date.now();
          await db.yarns.update(yid, {
            isDeleted: false,
            deletedAt: null,
            updatedAt: now,
          } as any);
          toast.success('실을 다시 살렸어요');
        },
      },
    });
  }

  const numeric: (keyof typeof f)[] = ['totalGrams', 'metersPer100g'];
  const u = (k: keyof typeof f) => (e: any) =>
    setF({ ...f, [k]: numeric.includes(k) ? Number(e.target.value) || 0 : e.target.value });

  // 적어둔 기준값이 있을 때만 총 길이를 보여준다
  const totalMeters = gramsToMeters(f.totalGrams, f.metersPer100g);

  return (
    <div className="space-y-4">
      <PageHeader title={editing ? '실 수정' : '새 실'} back />
      {dialog}
      <Field label="대표 이미지">
        <ImageInput value={photo} onChange={setPhoto} aspect="square" />
      </Field>
      <Field label="이름 *"><input className={inp} value={f.name} onChange={u('name')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="브랜드"><input className={inp} value={f.brand} onChange={u('brand')} /></Field>
        <Field label="구매처"><input className={inp} value={f.shop} onChange={u('shop')} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="컬러명"><input className={inp} value={f.colorName} onChange={u('colorName')} /></Field>
        <Field label="컬러번호"><input className={inp} value={f.colorCode} onChange={u('colorCode')} /></Field>
      </div>
      <Field label="구매 링크">
        <input
          className={inp}
          type="url"
          inputMode="url"
          value={f.link}
          onChange={u('link')}
          placeholder="https://…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="성분"><input className={inp} value={f.fiber} onChange={u('fiber')} placeholder="울 100%" /></Field>
        <Field label="굵기"><input className={inp} value={f.weight} onChange={u('weight')} placeholder="fingering" /></Field>
      </div>
      <div className="space-y-2">
        <span className="block text-xs font-medium text-muted-foreground">게이지 정보</span>
        {/* 합 · 바늘 · 게이지 · 삭제를 한 줄에 — 위아래로 나뉘면 어느 합의 값인지 눈이 헤맨다 */}
        {recs.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="flex shrink-0 items-center gap-1">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                aria-label="합수"
                className={`${inp} w-12 px-1 text-center`}
                value={r.strands}
                onChange={e => updateRec(i, { strands: e.target.value })}
              />
              <span className="text-[12.5px] font-semibold text-muted-foreground">합</span>
            </div>
            <input
              className={`${inp} min-w-0 flex-1 px-2.5`}
              value={r.needleSize}
              onChange={e => updateRec(i, { needleSize: e.target.value })}
              placeholder="4.0mm"
            />
            <input
              className={`${inp} min-w-0 flex-[1.4] px-2.5`}
              value={r.gauge}
              onChange={e => updateRec(i, { gauge: e.target.value })}
              placeholder="22코 30단"
            />
            <button
              type="button"
              onClick={() => removeRec(i)}
              aria-label={`${r.strands || ''}합 지우기`}
              className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRec}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-2.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft/40 hover:text-primary"
        >
          <Plus className="h-4 w-4" /> 게이지 추가
        </button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          ※ 같은 실이라도 합수에 따라 권장 바늘과 게이지가 달라져요. 1합, 2합을 따로 적어두면 도안 맞출 때 편합니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="총 보유량 (g)">
          <input type="number" inputMode="decimal" className={inp} value={f.totalGrams} onChange={u('totalGrams')} />
        </Field>
        <Field label="100g당 길이 (m)">
          <input
            type="number"
            inputMode="decimal"
            className={inp}
            value={f.metersPer100g || ''}
            onChange={u('metersPer100g')}
            placeholder="400"
          />
        </Field>
      </div>
      {totalMeters !== null ? (
        <p className="-mt-2 rounded-xl bg-primary-soft/60 px-3 py-2.5 text-[12px] font-semibold text-primary">
          총 길이 약 {formatMeters(totalMeters)}
        </p>
      ) : (
        <p className="-mt-2 text-[11px] leading-relaxed text-muted-foreground">
          ※ 100g당 길이를 적어두면 총 길이를 대신 계산해 드려요. 라벨이 50g / 200m 이면 400 을 적으시면 됩니다.
        </p>
      )}
      <Field label="메모"><textarea className={`${inp} min-h-[72px]`} value={f.note} onChange={u('note')} /></Field>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2">
          {editing && (
            <button onClick={remove} className="rounded-full border border-destructive/30 px-4 py-2.5 text-sm text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={save} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-soft">
            <Save className="h-4 w-4" /> 저장
          </button>
        </div>
      </div>
    </div>
  );
}

const inp = 'w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
