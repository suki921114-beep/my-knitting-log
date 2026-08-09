import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, now } from '@/lib/db';
import PageHeader from '@/components/PageHeader';
import { useConfirm } from '@/hooks/useConfirm';
import { ImageInput } from '@/components/ImageInput';
import { toast } from '@/components/ui/sonner';
import { Plus, Save, Trash2, HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  gramsToMeters,
  formatMeters,
  yarnRecommendations,
  YARN_WEIGHTS,
  YARN_DYE_TYPES,
  GAUGE_PATTERNS,
  GAUGE_WASH_STATES,
  gaugePatternLabel,
} from '@/lib/yarnCalc';

export default function YarnForm() {
  const { id } = useParams();
  const yid = id ? Number(id) : undefined;
  const editing = !!yid;
  const nav = useNavigate();
  const { confirm, dialog } = useConfirm();
  const existing = useLiveQuery(() => (yid ? db.yarns.get(yid) : undefined), [yid]);

  const [f, setF] = useState({
    name: '', brand: '', colorName: '', colorCode: '', shop: '', link: '', fiber: '', weight: '',
    plySpec: '', dyeType: '', totalGrams: '', metersPer100g: '', note: '',
  });
  // 겹수별 권장 바늘·게이지. 화면에서는 문자열로 다루고 저장할 때 숫자로 바꾼다.
  const [recs, setRecs] = useState<
    { strands: string; needleSize: string; gauge: string; gaugePattern: string; washState: string }[]
  >([]);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [hyd, setHyd] = useState(false);

  useEffect(() => {
    if (editing && existing && !hyd) {
      setF({
        name: existing.name, brand: existing.brand || '', colorName: existing.colorName || '',
        colorCode: existing.colorCode || '', shop: existing.shop || '', link: existing.link || '',
        fiber: existing.fiber || '',
        weight: existing.weight || '',
        plySpec: existing.plySpec || '',
        dyeType: existing.dyeType || '',
        totalGrams: existing.totalGrams ? String(existing.totalGrams) : '',
        metersPer100g: existing.metersPer100g ? String(existing.metersPer100g) : '',
        note: existing.note || '',
      });
      // 예전에 한 줄로 적어둔 값도 1겹으로 올라온다
      setRecs(
        yarnRecommendations(existing).map(r => ({
          strands: String(r.strands),
          needleSize: r.needleSize || '',
          gauge: r.gauge || '',
          // 예전에 '무메' 로 저장된 값은 지금 이름으로 바꿔서 보여준다
          gaugePattern: gaugePatternLabel(r.gaugePattern) || '',
          washState: r.washState || '',
        })),
      );
      setPhoto(existing.photoDataUrl);
      setHyd(true);
    }
  }, [editing, existing, hyd]);

  function addRec() {
    // 다음 겹수를 미리 채워준다 — 대개 1겹 다음은 2겹이다
    const next = recs.reduce((max, r) => Math.max(max, Number(r.strands) || 0), 0) + 1;
    setRecs([...recs, { strands: String(next), needleSize: '', gauge: '', gaugePattern: '', washState: '' }]);
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
    // 겹수가 없거나 바늘·게이지를 둘 다 비워둔 줄은 버린다
    const recommendations = recs
      .map(r => ({
        strands: Number(r.strands) || 0,
        needleSize: r.needleSize.trim() || undefined,
        gauge: r.gauge.trim() || undefined,
        gaugePattern: r.gaugePattern || undefined,
        washState: r.washState || undefined,
      }))
      .filter(r => r.strands > 0 && (r.needleSize || r.gauge))
      .sort((a, b) => a.strands - b.strands);

    const payload = {
      ...f,
      // 안 적었으면 0 이 아니라 '없음'으로 둔다. 0m/100g 인 실은 없다.
      totalGrams: grams,
      metersPer100g: per100g > 0 ? per100g : undefined,
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

  // 숫자 칸도 글자 그대로 들고 있다가 저장할 때만 숫자로 바꾼다.
  // 숫자로 들고 있으면 빈 칸을 표현할 수 없어 0 이 박혀 있게 되고,
  // 그 0 을 지우기 전에 숫자를 치면 '0100' 같은 값이 된다.
  const u = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  // 목록에 없는 굵기를 적고 있는 중인지. 빈 칸과 구분하려고 공백 하나를 표시로 쓴다.
  const isCustomWeight = !!f.weight && !(YARN_WEIGHTS as readonly string[]).includes(f.weight.trim());

  const grams = Number(f.totalGrams) || 0;
  const per100g = Number(f.metersPer100g) || 0;

  // 적어둔 기준값이 있을 때만 총 길이를 보여준다
  const totalMeters = gramsToMeters(grams, per100g);

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
        {/* ⚠️ type="url" 을 쓰지 않는다.
            브라우저가 URL 칸에서 한글 입력기를 꺼버리는데, 다음 칸으로 옮겨도
            다시 켜주지 않는다. 그래서 바로 아래 성분 칸이 영문으로 시작한다.
            inputMode 만으로도 폰에서는 주소용 자판이 뜬다. */}
        <input
          className={inp}
          inputMode="url"
          value={f.link}
          onChange={u('link')}
          placeholder="https://…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="성분"><input className={inp} value={f.fiber} onChange={u('fiber')} placeholder="울 100%" /></Field>
        <Field label="수·합"><input className={inp} value={f.plySpec} onChange={u('plySpec')} placeholder="15수 4합" /></Field>
      </div>

      {/* 글로 적게 두면 '핑거링' 과 '핑거링사' 가 다른 굵기로 갈라진다.
          그래서 골라 담게 하되, 목록에 없는 실을 위해 직접 적는 길은 남긴다. */}
      <FieldDiv label="굵기">
        <div className="flex flex-wrap gap-1.5">
          {YARN_WEIGHTS.map(w => (
            <Pill key={w} active={f.weight === w} onClick={() => setF({ ...f, weight: f.weight === w ? '' : w })}>
              {w}
            </Pill>
          ))}
          <Pill active={isCustomWeight} onClick={() => setF({ ...f, weight: isCustomWeight ? '' : ' ' })}>
            기타
          </Pill>
        </div>
        {isCustomWeight && (
          <input
            className={`${inp} mt-2`}
            value={f.weight.trim()}
            onChange={e => setF({ ...f, weight: e.target.value || ' ' })}
            placeholder="어떤 굵기인가요?"
          />
        )}
      </FieldDiv>

      <FieldDiv label="실 종류">
        <div className="flex flex-wrap gap-1.5">
          {YARN_DYE_TYPES.map(d => (
            <Pill key={d} active={f.dyeType === d} onClick={() => setF({ ...f, dyeType: f.dyeType === d ? '' : d })}>
              {d}
            </Pill>
          ))}
        </div>
      </FieldDiv>
      <div className="space-y-2">
        {/* 안내는 물음표 뒤로 숨긴다. 늘 펼쳐 두면 두 번째부터는 안 읽히고
            자리만 차지한다 — 처음 한 번 궁금할 때 눌러 보면 된다. */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-muted-foreground">게이지 정보</span>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="게이지 정보 설명"
                className="rounded-full p-0.5 text-muted-foreground transition hover:bg-secondary hover:text-primary"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3 text-[12px] leading-relaxed text-ink">
              겹수·무늬·세탁 여부에 따라 게이지가 달라져요. 조건별로 따로 적어두면 도안 맞출 때 편합니다.
            </PopoverContent>
          </Popover>
        </div>
        {/* 한 줄에 다섯 칸을 욱여넣으니 폰에서 칸이 뭉개졌다. 그래서 두 줄로 나눈다.
            윗줄은 '어떤 조건에서 쟀는지', 아랫줄은 '잰 값'.

            ⚠️ 폭은 반드시 바깥 div 가 정할 것. inp 에 w-full 이 들어 있어서
               input·select 에 폭을 직접 붙이면 둘이 부딪혀 칸이 제멋대로 벌어진다.
               (한 번 이 문제로 화면이 통째로 무너진 적이 있다) */}
        {recs.map((r, i) => (
          <div key={i} className="space-y-1.5 rounded-2xl border border-border bg-secondary/25 p-2">
            {/* 윗줄 — 어떤 조건에서 잰 게이지인지 */}
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <select
                  value={r.gaugePattern}
                  onChange={e => updateRec(i, { gaugePattern: e.target.value })}
                  aria-label="메리야스 / 무늬"
                  className={`${inp} appearance-none px-2 py-2 text-center text-[12.5px]`}
                >
                  <option value="">메리야스/무늬</option>
                  {GAUGE_PATTERNS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="min-w-0 flex-1">
                <select
                  value={r.washState}
                  onChange={e => updateRec(i, { washState: e.target.value })}
                  aria-label="세탁 전 / 세탁 후"
                  className={`${inp} appearance-none px-2 py-2 text-center text-[12.5px]`}
                >
                  <option value="">세탁 전/후</option>
                  {GAUGE_WASH_STATES.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeRec(i)}
                aria-label={`${r.strands || ''}겹 지우기`}
                className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* 아랫줄 — 잰 값. 겹 · 바늘 · 코단 순으로 읽힌다 */}
            <div className="flex items-center gap-1.5">
              <div className="flex shrink-0 items-center gap-0.5">
                <div className="w-[2.75rem]">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    aria-label="겹수"
                    className={`${inp} px-1 py-2 text-center text-[13px]`}
                    value={r.strands}
                    onChange={e => updateRec(i, { strands: e.target.value })}
                  />
                </div>
                <span className="text-[12px] font-semibold text-muted-foreground">겹</span>
              </div>
              {/* 숫자만 받고 mm 는 칸 밖에 적는다 — '4.0mm' 를 통째로 적게 하면
                  사람마다 4mm / 4.0 / 4호 로 갈려서 나중에 묶이지 않는다.
                  ⚠️ type='number' 는 쓰지 않는다. 예전에 '5호' 처럼 적어둔 값이
                     빈 칸으로 보이면서 저장할 때 통째로 지워진다. */}
              <div className="flex min-w-0 flex-1 items-center gap-0.5">
                <input
                  inputMode="decimal"
                  aria-label="바늘 호수 (mm)"
                  className={`${inp} px-2 py-2 text-center text-[13px]`}
                  value={r.needleSize}
                  onChange={e => updateRec(i, { needleSize: e.target.value })}
                  placeholder="4.0"
                />
                <span className="shrink-0 text-[12px] font-semibold text-muted-foreground">mm</span>
              </div>
              <div className="min-w-0 flex-[1.4]">
                <input
                  className={`${inp} px-2.5 py-2 text-[13px]`}
                  value={r.gauge}
                  onChange={e => updateRec(i, { gauge: e.target.value })}
                  placeholder="22코 30단"
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addRec}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-2.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft/40 hover:text-primary"
        >
          <Plus className="h-4 w-4" /> 게이지 추가
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="총 보유량 (g)">
          <input type="number" inputMode="decimal" min={0} className={inp} value={f.totalGrams} onChange={u('totalGrams')} placeholder="200" />
        </Field>
        <Field label="100g당 길이 (m)">
          <input
            type="number"
            inputMode="decimal"
            className={inp}
            min={0}
            value={f.metersPer100g}
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
/** 골라 담는 알약 버튼 — 이 화면 안에서만 쓴다 */
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border text-muted-foreground'
      }`}
    >
      {children}
    </button>
  );
}

/** 안에 버튼이 들어가는 칸 — label 로 감싸면 버튼 클릭이 엉킨다 */
function FieldDiv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
