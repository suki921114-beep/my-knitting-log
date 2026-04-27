import Dexie, { Table } from 'dexie';

export type ProjectStatus = 'planned' | 'in_progress' | 'done' | 'on_hold';

export interface Project {
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
  photos?: string[]; // dataURL (legacy + new multi-photo)
  createdAt: number;
  updatedAt: number;
}

export interface Pattern {
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

export interface Yarn {
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

export interface Needle {
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

export interface Notion {
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

export interface ProjectYarn {
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

export interface ProjectPattern {
  id?: number;
  projectId: number;
  patternId: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectNeedle {
  id?: number;
  projectId: number;
  needleId: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectNotion {
  id?: number;
  projectId: number;
  notionId: number;
  quantity?: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RowCounter {
  id?: number;
  projectId: number;
  name: string;
  count: number;
  goal?: number;
  createdAt: number;
  updatedAt: number;
}

export interface GaugePreset {
  id?: number;
  name: string;
  stitches: number; // per 10cm
  rows: number;     // per 10cm
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
  }
}

export const db = new KnitDB();

export const now = () => Date.now();

export async function exportAll() {
  const data = {
    version: 2,
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
  };
  return data;
}

export async function importAll(data: any) {
  await db.transaction(
    'rw',
    [db.projects, db.patterns, db.yarns, db.needles, db.notions, db.projectYarns, db.projectPatterns, db.projectNeedles, db.projectNotions],
    async () => {
      if (data.projects) await db.projects.bulkPut(data.projects);
      if (data.patterns) await db.patterns.bulkPut(data.patterns);
      if (data.yarns) await db.yarns.bulkPut(data.yarns);
      if (data.needles) await db.needles.bulkPut(data.needles);
      if (data.notions) await db.notions.bulkPut(data.notions);
      if (data.projectYarns) await db.projectYarns.bulkPut(data.projectYarns);
      if (data.projectPatterns) await db.projectPatterns.bulkPut(data.projectPatterns);
      if (data.projectNeedles) await db.projectNeedles.bulkPut(data.projectNeedles);
      if (data.projectNotions) await db.projectNotions.bulkPut(data.projectNotions);
    }
  );
}

export async function clearAll() {
  await db.transaction(
    'rw',
    [db.projects, db.patterns, db.yarns, db.needles, db.notions, db.projectYarns, db.projectPatterns, db.projectNeedles, db.projectNotions],
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
      ]);
    }
  );
}
