import Dexie, { Table } from 'dexie';
import { ensureSyncMeta, planImport } from './importMerge';

export type ProjectStatus = 'planned' | 'in_progress' | 'done' | 'on_hold';

export interface SyncMetadata {
  cloudId?: string;
  isDeleted?: boolean;
  deletedAt?: number | null;
}

/**
 * 사진 한 장 — Firebase Storage 동기화 + 로컬 dataUrl 캐시.
 * 프로젝트와 다이어리가 같은 모양을 쓴다.
 *
 * - cloudId: 사진 식별자 (Storage path 안에 들어가는 UUID)
 * - dataUrl: 로컬 캐시. Firestore/Storage payload 에는 절대 안 보냄.
 * - storagePath: Storage 업로드 후 채워짐. 비어 있으면 '아직 업로드 안 됨'.
 *
 * sync/project.ts 의 buildProjectSyncPayload 가 storagePath 가 비어 있는 사진을
 * 자동으로 Storage 에 업로드하고 메타를 갱신.
 */
export interface ProjectPhoto {
  cloudId: string;
  dataUrl?: string;
  storagePath?: string;
  contentType?: string;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
  deletedAt: number | null;
}

export interface Project extends SyncMetadata {
  id?: number;
  name: string;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  patternId?: number; // legacy single pattern (kept for back-compat)
  size?: string;
  gauge?: string;
  progressNote?: string;
  /**
   * 프로젝트 메모 — 도안을 어떻게 바꿨는지, 파트마다 실이 얼마나 들었는지처럼
   * 뜨는 내내 들춰보는 글. 다이어리는 그날그날의 기록이라 성격이 다르다.
   */
  memo?: string;
  finishedNote?: string;
  /**
   * 사진. v6 부터 ProjectPhoto[] 객체 배열.
   * v5 이하의 string[] (dataURL 만) 데이터는 v6 upgrade 에서 자동 변환됨.
   */
  photos?: ProjectPhoto[];
  createdAt: number;
  updatedAt: number;
}

export interface Pattern extends SyncMetadata {
  id?: number;
  name: string;
  designer?: string;
  source?: string;
  link?: string;
  fileDataUrl?: string;
  imageDataUrl?: string; // 대표 이미지
  /** 대표 이미지가 올라간 Storage 위치. 그림 자체는 문서에 담지 않는다. */
  imageStoragePath?: string;
  difficulty?: string;
  sizeInfo?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 겹수별 권장값.
 *
 * 같은 실이라도 한 가닥으로 뜰 때와 두 가닥을 겹쳐 뜰 때 권장 바늘 호수와
 * 게이지가 달라진다. 한 줄로는 담을 수 없어 겹수마다 따로 적어둔다.
 *
 * ⚠️ '겹' 과 '합' 은 다른 말이다.
 *    합 — 실 자체가 몇 가닥으로 꼬여 있는지 (예: 15수 4합사). 실의 성질이다.
 *    겹 — 뜰 때 몇 가닥을 함께 잡는지. 뜨는 방법이다.
 *    여기 strands 는 '겹' 이다. 처음에 '합' 이라고 잘못 적어두었다.
 */
export interface YarnRecommendation {
  /** 몇 겹으로 잡고 떴을 때인지 */
  strands: number;
  /** 권장 바늘 호수 (예: "4.0mm", "5호") */
  needleSize?: string;
  /** 권장 게이지 (예: "22코 30단 / 10cm") */
  gauge?: string;
  /**
   * 어떤 뜨기로 잰 게이지인지 — '무메' | '무늬'
   * 같은 실 같은 바늘이라도 무늬가 들어가면 코수가 달라진다.
   */
  gaugePattern?: string;
}

export interface Yarn extends SyncMetadata {
  id?: number;
  name: string;
  brand?: string;
  colorName?: string;
  colorCode?: string;
  shop?: string;
  /** 구매 링크 (쇼핑몰 상품 페이지 등) */
  link?: string;
  fiber?: string;
  /** 굵기 — 핑거링·DK 처럼 흔히 쓰는 이름. 목록에 없으면 직접 적는다. */
  weight?: string;
  /**
   * 실 자체의 성질 — '15수 4합' 처럼 몇 수 몇 합인지.
   *
   * ⚠️ 겹(recommendations 의 strands) 과 다르다.
   *    합 — 실이 몇 가닥으로 꼬여 있는지. 실을 살 때 정해진다.
   *    겹 — 뜰 때 몇 가닥을 함께 잡는지. 뜨는 사람이 정한다.
   */
  plySpec?: string;
  /** 일반실 | 염색실. 염색실만 모아 보고 합사할 실을 고를 때 쓴다. */
  dyeType?: string;
  /**
   * @deprecated 합수별로 나뉘기 전에 쓰던 한 줄짜리 값.
   * 새로 저장할 때는 recommendations 로 옮기고 비운다.
   * 화면에서는 yarnRecommendations() 를 거칠 것 — 직접 읽지 말 것.
   */
  needleSize?: string;
  /** @deprecated needleSize 와 같은 이유 */
  gauge?: string;
  /** 합수별 권장 바늘·게이지 */
  recommendations?: YarnRecommendation[];
  totalGrams: number;
  /**
   * 다 쓴 실.
   *
   * 잔량은 총량에서 사용량을 빼서 나오는데, 실제로는 딱 떨어지지 않는다.
   * 프로젝트마다 g 을 정확히 안 적기도 하고, 자투리는 그냥 버리기도 한다.
   * 그래서 "이건 끝났다" 고 사람이 직접 말할 수 있게 둔다. 켜지면 잔량은 0.
   */
  usedUp?: boolean;
  /** 대표 이미지가 올라간 Storage 위치. 그림 자체는 문서에 담지 않는다. */
  photoStoragePath?: string;
  /**
   * 100g 당 길이(m). 라벨에 적힌 값을 100g 기준으로 환산해 적는다.
   * 콘사처럼 무게로만 파는 실도 이 값만 있으면 총 길이를 알 수 있다.
   * 값이 없으면 길이 계산을 아예 보여주지 않는다 — 모르는 걸 0 으로 꾸미지 않는다.
   */
  metersPer100g?: number;
  note?: string;
  photoDataUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Needle extends SyncMetadata {
  id?: number;
  /**
   * 큰 갈래 — '대바늘' | '코바늘' | '장갑바늘' 또는 직접 적은 말(기타).
   * 읽고 쓸 때는 src/lib/needleType.ts 의 readNeedle / writeNeedle 을 거칠 것.
   */
  type: string;
  /** 대바늘의 세부 갈래 — '줄바늘' | '조립식' */
  subType?: string;
  /** 대바늘 팁 길이 — '숏팁' | '롱팁' */
  tipLength?: string;
  sizeMm?: string;
  /**
   * 같은 바늘을 몇 개 가지고 있는지. 없거나 1이면 한 개.
   * 하나는 쓰는 중이고 하나는 남았는지 알고 싶을 때 쓴다.
   */
  quantity?: number;
  brand?: string;
  material?: string;
  length?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Notion extends SyncMetadata {
  id?: number;
  name: string;
  kind?: string;
  quantity?: number;
  shop?: string;
  note?: string;
  photoDataUrl?: string;
  /** 대표 이미지가 올라간 Storage 위치. 그림 자체는 문서에 담지 않는다. */
  photoStoragePath?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectYarn extends SyncMetadata {
  id?: number;
  projectId: number;
  yarnId: number;
  usedGrams: number;
  /** 예상 소요량(g). 주로 'planned' 프로젝트에서 부족 여부 판단에 사용 */
  plannedGrams?: number;
  colorNote?: string;
  usageNote?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectPattern extends SyncMetadata {
  id?: number;
  projectId: number;
  patternId: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectNeedle extends SyncMetadata {
  id?: number;
  projectId: number;
  needleId: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectNotion extends SyncMetadata {
  id?: number;
  projectId: number;
  notionId: number;
  quantity?: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 뜨개 기록 한 편 — 다이어리의 최소 단위.
 *
 * 다이어리와 프로젝트 메모를 따로 두지 않는다. 기록은 하나이고 보는 입구만 둘이다.
 *   - 프로젝트 상세: 그 프로젝트에 연결된 기록만
 *   - 다이어리: 모든 기록을 날짜순으로
 * projectId 가 없으면 프로젝트와 무관한 일상 기록(실 구매, 손목 쉼 등).
 */
export interface KnitLog extends SyncMetadata {
  id?: number;
  /** 연결된 프로젝트. 없으면 자유 기록 */
  projectId?: number;
  /** 기록 날짜 'YYYY-MM-DD' — 작성 시각과 별개로 사용자가 고를 수 있다 */
  date: string;
  text: string;
  /** 그날 뜬 단수 (선택) */
  rows?: number;
  /** 기분 이모지 (선택) */
  mood?: string;
  photos?: ProjectPhoto[];
  createdAt: number;
  updatedAt: number;
}

export interface RowCounter extends SyncMetadata {
  id?: number;
  projectId: number;
  name: string;
  count: number;
  goal?: number;
  createdAt: number;
  updatedAt: number;
}

export interface GaugePreset extends SyncMetadata {
  id?: number;
  name: string;
  stitches: number; // per 10cm
  rows: number;     // per 10cm
  createdAt: number;
  updatedAt: number;
}

export type GaugeMode = 'pattern' | 'cm';

export interface ProjectGauge extends SyncMetadata {
  id?: number;
  projectId: number;
  name: string;
  /** 'pattern' (default): 도안 코수/단수 기준  |  'cm': 목표 치수(cm) 기준 */
  mode?: GaugeMode;
  patternStitches: number; // per 10cm
  patternRows: number;     // per 10cm
  myStitches: number;      // per 10cm
  myRows: number;          // per 10cm
  /** 'cm' 모드에서 사용 */
  targetCm: number;
  /** 'pattern' 모드에서 사용: 도안에 적힌 코수 */
  patternTargetStitches?: number;
  /** 'pattern' 모드에서 사용: 도안에 적힌 단수 */
  patternTargetRows?: number;
  resultStitches: number;
  resultRows: number;
  memo?: string;
  createdAt: number;
  updatedAt: number;
}

class KnitDB extends Dexie {
  projects!: Table<Project, number>;
  patterns!: Table<Pattern, number>;
  yarns!: Table<Yarn, number>;
  needles!: Table<Needle, number>;
  notions!: Table<Notion, number>;
  projectYarns!: Table<ProjectYarn, number>;
  projectPatterns!: Table<ProjectPattern, number>;
  projectNeedles!: Table<ProjectNeedle, number>;
  projectNotions!: Table<ProjectNotion, number>;
  rowCounters!: Table<RowCounter, number>;
  gaugePresets!: Table<GaugePreset, number>;
  projectGauges!: Table<ProjectGauge, number>;
  logs!: Table<KnitLog, number>;

  constructor() {
    super('knit-db');
    this.version(1).stores({
      projects: '++id, status, updatedAt, name',
      patterns: '++id, name, updatedAt',
      yarns: '++id, name, brand, updatedAt',
      needles: '++id, type, updatedAt',
      notions: '++id, name, updatedAt',
      projectYarns: '++id, projectId, yarnId',
    });
    // v2: link tables for patterns/needles/notions
    this.version(2).stores({
      projects: '++id, status, updatedAt, name',
      patterns: '++id, name, updatedAt',
      yarns: '++id, name, brand, updatedAt',
      needles: '++id, type, updatedAt',
      notions: '++id, name, updatedAt',
      projectYarns: '++id, projectId, yarnId',
      projectPatterns: '++id, projectId, patternId',
      projectNeedles: '++id, projectId, needleId',
      projectNotions: '++id, projectId, notionId',
    }).upgrade(async tx => {
      // migrate legacy single patternId on projects → projectPatterns rows
      const projects = await tx.table('projects').toArray();
      const t = Date.now();
      for (const p of projects) {
        if (p.patternId) {
          await tx.table('projectPatterns').add({
            projectId: p.id,
            patternId: p.patternId,
            createdAt: t,
            updatedAt: t,
          });
        }
      }
    });
    // v3: row counters & gauge presets
    this.version(3).stores({
      projects: '++id, status, updatedAt, name',
      patterns: '++id, name, updatedAt',
      yarns: '++id, name, brand, updatedAt',
      needles: '++id, type, updatedAt',
      notions: '++id, name, updatedAt',
      projectYarns: '++id, projectId, yarnId',
      projectPatterns: '++id, projectId, patternId',
      projectNeedles: '++id, projectId, needleId',
      projectNotions: '++id, projectId, notionId',
      rowCounters: '++id, projectId, updatedAt',
      gaugePresets: '++id, updatedAt',
    });
    // v4: per-project gauge calculations
    this.version(4).stores({
      projects: '++id, status, updatedAt, name',
      patterns: '++id, name, updatedAt',
      yarns: '++id, name, brand, updatedAt',
      needles: '++id, type, updatedAt',
      notions: '++id, name, updatedAt',
      projectYarns: '++id, projectId, yarnId',
      projectPatterns: '++id, projectId, patternId',
      projectNeedles: '++id, projectId, needleId',
      projectNotions: '++id, projectId, notionId',
      rowCounters: '++id, projectId, updatedAt',
      gaugePresets: '++id, updatedAt',
      projectGauges: '++id, projectId, updatedAt',
    });
    // v5: cloudId & isDeleted for cloud sync
    this.version(5).stores({
      projects: '++id, cloudId, isDeleted, updatedAt, status, name',
      patterns: '++id, cloudId, isDeleted, updatedAt, name',
      yarns: '++id, cloudId, isDeleted, updatedAt, name, brand',
      needles: '++id, cloudId, isDeleted, updatedAt, type',
      notions: '++id, cloudId, isDeleted, updatedAt, name',
      projectYarns: '++id, cloudId, isDeleted, updatedAt, projectId, yarnId',
      projectPatterns: '++id, cloudId, isDeleted, updatedAt, projectId, patternId',
      projectNeedles: '++id, cloudId, isDeleted, updatedAt, projectId, needleId',
      projectNotions: '++id, cloudId, isDeleted, updatedAt, projectId, notionId',
      rowCounters: '++id, cloudId, isDeleted, updatedAt, projectId',
      gaugePresets: '++id, cloudId, isDeleted, updatedAt',
      projectGauges: '++id, cloudId, isDeleted, updatedAt, projectId',
    }).upgrade(async tx => {
      const tables = [
        'projects', 'patterns', 'yarns', 'needles', 'notions',
        'projectYarns', 'projectPatterns', 'projectNeedles', 'projectNotions',
        'rowCounters', 'gaugePresets', 'projectGauges'
      ];
      for (const tableName of tables) {
        const table = tx.table(tableName);
        const records = await table.toArray();
        for (const record of records) {
          if (!record.cloudId) {
            record.cloudId = crypto.randomUUID();
            record.isDeleted = false;
            record.deletedAt = null;
            // createdAt과 updatedAt이 혹시라도 없는 예전 데이터를 위한 폴백
            if (!record.createdAt) record.createdAt = Date.now();
            if (!record.updatedAt) record.updatedAt = Date.now();
            await table.put(record);
          }
        }
      }
    });

    // v6: 프로젝트 사진을 string[] (dataURL 배열) 에서 ProjectPhoto[] (객체 배열) 로
    // 마이그레이션. Firebase Storage 동기화를 위해 cloudId/storagePath 등의 메타가 필요.
    this.version(6).stores({
      // 인덱스 변경 없음 — 같은 stores 선언 유지 (Dexie 는 version bump 만으로 upgrade 호출)
      projects: '++id, cloudId, isDeleted, updatedAt, status, name',
      patterns: '++id, cloudId, isDeleted, updatedAt, name',
      yarns: '++id, cloudId, isDeleted, updatedAt, name, brand',
      needles: '++id, cloudId, isDeleted, updatedAt, type',
      notions: '++id, cloudId, isDeleted, updatedAt, name',
      projectYarns: '++id, cloudId, isDeleted, updatedAt, projectId, yarnId',
      projectPatterns: '++id, cloudId, isDeleted, updatedAt, projectId, patternId',
      projectNeedles: '++id, cloudId, isDeleted, updatedAt, projectId, needleId',
      projectNotions: '++id, cloudId, isDeleted, updatedAt, projectId, notionId',
      rowCounters: '++id, cloudId, isDeleted, updatedAt, projectId',
      gaugePresets: '++id, cloudId, isDeleted, updatedAt',
      projectGauges: '++id, cloudId, isDeleted, updatedAt, projectId',
    }).upgrade(async (tx) => {
      // 마이그레이션 중 발생하는 put/update 가 dirty hook 을 발화시켜
      // 첫 로드 직후 의도치 않은 자동 백업이 트리거되는 문제 방지.
      pauseDirtyTracking();
      try {
        const projects = await tx.table('projects').toArray();
        const now = Date.now();
        for (const p of projects) {
          if (!p || !Array.isArray(p.photos)) continue;
          // 이미 객체 배열이면 통과
          if (p.photos.length === 0 || typeof p.photos[0] === 'object') continue;
          // string[] (dataURL) → ProjectPhoto[] 변환
          const converted = (p.photos as string[]).map((url: string) => ({
            cloudId: crypto.randomUUID(),
            dataUrl: url,
            storagePath: undefined,
            contentType: extractDataUrlContentType(url) ?? 'image/jpeg',
            createdAt: p.createdAt ?? now,
            updatedAt: now,
            isDeleted: false,
            deletedAt: null,
          }));
          await tx.table('projects').put({ ...p, photos: converted });
        }
      } finally {
        resumeDirtyTracking();
        // 마이그레이션 직후의 잔존 dirty 상태 정리 (안전장치)
        clearSyncDirty();
      }
    });

    // v7: 뜨개 기록(logs) 테이블 추가.
    // 기존 project.progressNote 는 한 칸짜리 필드라 덮어쓰면 이전 내용이 사라졌다.
    // 남아 있는 메모를 첫 기록으로 옮겨 히스토리가 쌓이는 구조로 전환한다.
    this.version(7).stores({
      projects: '++id, cloudId, isDeleted, updatedAt, status, name',
      patterns: '++id, cloudId, isDeleted, updatedAt, name',
      yarns: '++id, cloudId, isDeleted, updatedAt, name, brand',
      needles: '++id, cloudId, isDeleted, updatedAt, type',
      notions: '++id, cloudId, isDeleted, updatedAt, name',
      projectYarns: '++id, cloudId, isDeleted, updatedAt, projectId, yarnId',
      projectPatterns: '++id, cloudId, isDeleted, updatedAt, projectId, patternId',
      projectNeedles: '++id, cloudId, isDeleted, updatedAt, projectId, needleId',
      projectNotions: '++id, cloudId, isDeleted, updatedAt, projectId, notionId',
      rowCounters: '++id, cloudId, isDeleted, updatedAt, projectId',
      gaugePresets: '++id, cloudId, isDeleted, updatedAt',
      projectGauges: '++id, cloudId, isDeleted, updatedAt, projectId',
      logs: '++id, cloudId, isDeleted, updatedAt, date, projectId',
    }).upgrade(async (tx) => {
      pauseDirtyTracking();
      try {
        const projects = await tx.table('projects').toArray();
        const logs = tx.table('logs');
        for (const p of projects) {
          const note = (p?.progressNote || '').trim();
          if (!note) continue;
          const t = p.updatedAt || p.createdAt || Date.now();
          await logs.add({
            projectId: p.id,
            // 마지막 수정 시각을 기록 날짜로 삼는다
            date: new Date(t).toISOString().slice(0, 10),
            text: note,
            createdAt: t,
            updatedAt: t,
            cloudId: crypto.randomUUID(),
            isDeleted: false,
            deletedAt: null,
          });
        }
      } finally {
        resumeDirtyTracking();
        clearSyncDirty();
      }
    });

    // v8: 프로젝트 사진을 대표 한 장으로 줄인다.
    //
    // 프로젝트에 사진을 여러 장 쌓으면 '언제 찍은 것인지'가 사라진다.
    // 앞으로 사진은 뜨개 기록에 붙이고, 프로젝트에는 대표 한 장만 둔다.
    //
    // 이미 올려둔 사진을 지울 수는 없으니 두 번째 장부터는 기록으로 옮긴다.
    // 기록 날짜는 프로젝트 시작일 — 없으면 만든 날.
    //
    // ⚠️ cloudId 를 프로젝트 cloudId 에서 만들어 낸다. 폰과 태블릿이 각자
    //    이 마이그레이션을 돌려도 같은 id 가 나와야 클라우드에서 한 건으로
    //    합쳐진다. 무작위로 만들면 기기 수만큼 기록이 늘어난다.
    this.version(8).stores({
      projects: '++id, cloudId, isDeleted, updatedAt, status, name',
      patterns: '++id, cloudId, isDeleted, updatedAt, name',
      yarns: '++id, cloudId, isDeleted, updatedAt, name, brand',
      needles: '++id, cloudId, isDeleted, updatedAt, type',
      notions: '++id, cloudId, isDeleted, updatedAt, name',
      projectYarns: '++id, cloudId, isDeleted, updatedAt, projectId, yarnId',
      projectPatterns: '++id, cloudId, isDeleted, updatedAt, projectId, patternId',
      projectNeedles: '++id, cloudId, isDeleted, updatedAt, projectId, needleId',
      projectNotions: '++id, cloudId, isDeleted, updatedAt, projectId, notionId',
      rowCounters: '++id, cloudId, isDeleted, updatedAt, projectId',
      gaugePresets: '++id, cloudId, isDeleted, updatedAt',
      projectGauges: '++id, cloudId, isDeleted, updatedAt, projectId',
      logs: '++id, cloudId, isDeleted, updatedAt, date, projectId',
    }).upgrade(async (tx) => {
      pauseDirtyTracking();
      try {
        const projects = await tx.table('projects').toArray();
        const logs = tx.table('logs');
        for (const p of projects) {
          const alive = ((p?.photos || []) as any[]).filter(ph => ph && !ph.isDeleted);
          if (alive.length <= 1) continue;

          const moved = alive.slice(1);
          const t = p.createdAt || Date.now();
          const date = p.startDate || new Date(t).toISOString().slice(0, 10);
          // 기기마다 같은 값이 나오도록 프로젝트 cloudId 에서 파생시킨다
          const cloudId = p.cloudId ? `${p.cloudId}-photos` : crypto.randomUUID();

          await logs.add({
            projectId: p.id,
            date,
            text: '프로젝트에 올려둔 사진이에요.',
            photos: moved,
            createdAt: t,
            updatedAt: Date.now(),
            cloudId,
            isDeleted: false,
            deletedAt: null,
          });

          // 프로젝트에는 첫 장만 남긴다
          await tx.table('projects').put({ ...p, photos: [alive[0]] });
        }
      } finally {
        resumeDirtyTracking();
        clearSyncDirty();
      }
    });

  }
}

export const db = new KnitDB();

export const now = () => Date.now();

export async function exportAll() {
  const data = {
    version: 5,
    exportedAt: new Date().toISOString(),
    projects: await db.projects.toArray(),
    patterns: await db.patterns.toArray(),
    yarns: await db.yarns.toArray(),
    needles: await db.needles.toArray(),
    notions: await db.notions.toArray(),
    projectYarns: await db.projectYarns.toArray(),
    projectPatterns: await db.projectPatterns.toArray(),
    projectNeedles: await db.projectNeedles.toArray(),
    projectNotions: await db.projectNotions.toArray(),
    rowCounters: await db.rowCounters.toArray(),
    gaugePresets: await db.gaugePresets.toArray(),
    projectGauges: await db.projectGauges.toArray(),
    logs: await db.logs.toArray(),
  };
  return data;
}

const IMPORT_TABLES = [
  'projects', 'patterns', 'yarns', 'needles', 'notions',
  'projectYarns', 'projectPatterns', 'projectNeedles', 'projectNotions',
  'rowCounters', 'gaugePresets', 'projectGauges', 'logs',
] as const;

export async function importAll(data: any) {
  await db.transaction(
    'rw',
    [db.projects, db.patterns, db.yarns, db.needles, db.notions, db.projectYarns, db.projectPatterns, db.projectNeedles, db.projectNotions, db.rowCounters, db.gaugePresets, db.projectGauges, db.logs],
    async () => {
      for (const name of IMPORT_TABLES) {
        const incoming = data?.[name];
        if (!incoming || !Array.isArray(incoming) || incoming.length === 0) continue;

        const table = (db as any)[name];
        // 낡은 백업(cloudId 없음)은 여기서 메타를 채운다
        const prepared = ensureSyncMeta(incoming);
        // 동일성 판단은 cloudId 로 — 백업 파일의 id 로 로컬 레코드를 덮어쓰지 않는다
        const existing = await table.toArray();
        const { toUpdate, toAdd } = planImport(prepared, existing);

        if (toUpdate.length) await table.bulkPut(toUpdate);
        if (toAdd.length) await table.bulkAdd(toAdd);
      }
    }
  );
}

export async function clearAll() {
  // 전체 삭제는 'destructive' 흐름 — clear() 가 발화시키는 deleting hook 으로
  // dirty 가 켜져 자동 백업이 실행되면 사용자가 의도하지 않은 클라우드 동작
  // (재다운로드 또는 빈 데이터 덮어쓰기) 이 일어날 수 있다. dirty tracking 을
  // 일시 정지하고 트랜잭션 안에서 모든 테이블을 비운 뒤, 명시적으로 dirty 를
  // 해제한다.
  pauseDirtyTracking();
  try {
    await db.transaction(
      'rw',
      [db.projects, db.patterns, db.yarns, db.needles, db.notions, db.projectYarns, db.projectPatterns, db.projectNeedles, db.projectNotions, db.rowCounters, db.gaugePresets, db.projectGauges, db.logs],
      async () => {
        await Promise.all([
          db.projects.clear(),
          db.patterns.clear(),
          db.yarns.clear(),
          db.needles.clear(),
          db.notions.clear(),
          db.projectYarns.clear(),
          db.projectPatterns.clear(),
          db.projectNeedles.clear(),
          db.projectNotions.clear(),
          db.rowCounters.clear(),
          db.gaugePresets.clear(),
          db.projectGauges.clear(),
          db.logs.clear(),
        ]);
      }
    );
  } finally {
    resumeDirtyTracking();
    // pause 동안 들어온 dirty (없을 가능성 높지만 안전장치) 와, 직전 세션의
    // 잔존 dirty 모두 명시적으로 해제 — 자동 백업 재실행 방지.
    clearSyncDirty();
  }
}

// ============================================================================
// 사용자 변경 감지 — syncDirty 모듈에 hook 등록
// ============================================================================

import { attachDirtyHooks, pauseDirtyTracking, resumeDirtyTracking, clearSyncDirty } from './syncDirty';
attachDirtyHooks(db);


// dataURL 의 'data:image/png;base64,...' 에서 contentType 추출
function extractDataUrlContentType(dataUrl: string): string | undefined {
  if (typeof dataUrl !== 'string') return undefined;
  const m = dataUrl.match(/^data:([^;]+);/);
  return m ? m[1] : undefined;
}
