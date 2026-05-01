import Dexie, { Table } from 'dexie';

export type ProjectStatus = 'planned' | 'in_progress' | 'done' | 'on_hold';

export interface SyncMetadata {
  cloudId?: string;
  isDeleted?: boolean;
  deletedAt?: number | null;
}

/**
 * Project 사진 한 장 — Firebase Storage 동기화 + 로컬 dataUrl 캐시.
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
  difficulty?: string;
  sizeInfo?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Yarn extends SyncMetadata {
  id?: number;
  name: string;
  brand?: string;
  colorName?: string;
  colorCode?: string;
  shop?: string;
  fiber?: string;
  weight?: string;
  totalGrams: number;
  note?: string;
  photoDataUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Needle extends SyncMetadata {
  id?: number;
  type: string;
  sizeMm?: string;
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
  };
  return data;
}

export async function importAll(data: any) {
  await db.transaction(
    'rw',
    [db.projects, db.patterns, db.yarns, db.needles, db.notions, db.projectYarns, db.projectPatterns, db.projectNeedles, db.projectNotions, db.rowCounters, db.gaugePresets, db.projectGauges],
    async () => {
      // 만약 낡은 버전의 백업을 불러올 경우 cloudId가 없을 수 있으므로 import시 부여
      const ensureMeta = (items: any[] | undefined) => {
        if (!items) return [];
        return items.map(item => ({
          ...item,
          cloudId: item.cloudId || crypto.randomUUID(),
          isDeleted: item.isDeleted || false,
          deletedAt: item.deletedAt || null,
          createdAt: item.createdAt || Date.now(),
          updatedAt: item.updatedAt || Date.now(),
        }));
      };

      if (data.projects) await db.projects.bulkPut(ensureMeta(data.projects));
      if (data.patterns) await db.patterns.bulkPut(ensureMeta(data.patterns));
      if (data.yarns) await db.yarns.bulkPut(ensureMeta(data.yarns));
      if (data.needles) await db.needles.bulkPut(ensureMeta(data.needles));
      if (data.notions) await db.notions.bulkPut(ensureMeta(data.notions));
      if (data.projectYarns) await db.projectYarns.bulkPut(ensureMeta(data.projectYarns));
      if (data.projectPatterns) await db.projectPatterns.bulkPut(ensureMeta(data.projectPatterns));
      if (data.projectNeedles) await db.projectNeedles.bulkPut(ensureMeta(data.projectNeedles));
      if (data.projectNotions) await db.projectNotions.bulkPut(ensureMeta(data.projectNotions));
      if (data.rowCounters) await db.rowCounters.bulkPut(ensureMeta(data.rowCounters));
      if (data.gaugePresets) await db.gaugePresets.bulkPut(ensureMeta(data.gaugePresets));
      if (data.projectGauges) await db.projectGauges.bulkPut(ensureMeta(data.projectGauges));
    }
  );
}

export async function clearAll() {
  await db.transaction(
    'rw',
    [db.projects, db.patterns, db.yarns, db.needles, db.notions, db.projectYarns, db.projectPatterns, db.projectNeedles, db.projectNotions, db.rowCounters, db.gaugePresets, db.projectGauges],
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
      ]);
    }
  );
}

// ============================================================================
// 사용자 변경 감지 — syncDirty 모듈에 hook 등록
// ============================================================================

import { attachDirtyHooks } from './syncDirty';
attachDirtyHooks(db);


// dataURL 의 'data:image/png;base64,...' 에서 contentType 추출
function extractDataUrlContentType(dataUrl: string): string | undefined {
  if (typeof dataUrl !== 'string') return undefined;
  const m = dataUrl.match(/^data:([^;]+);/);
  return m ? m[1] : undefined;
}
