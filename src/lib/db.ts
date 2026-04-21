import Dexie, { Table } from 'dexie';

export type ProjectStatus = 'planned' | 'in_progress' | 'done' | 'on_hold';

export interface Project {
  id?: number;
  name: string;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  patternId?: number;
  size?: string;
  gauge?: string;
  progressNote?: string;
  finishedNote?: string;
  photos?: string[]; // dataURL
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
  weight?: string; // 굵기 (fingering 등)
  totalGrams: number;
  note?: string;
  photoDataUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Needle {
  id?: number;
  type: string; // 대바늘/코바늘/줄바늘
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
  createdAt: number;
  updatedAt: number;
}

export interface ProjectYarn {
  id?: number;
  projectId: number;
  yarnId: number;
  usedGrams: number;
  colorNote?: string;
  usageNote?: string;
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
  }
}

export const db = new KnitDB();

export const now = () => Date.now();

export async function exportAll() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: await db.projects.toArray(),
    patterns: await db.patterns.toArray(),
    yarns: await db.yarns.toArray(),
    needles: await db.needles.toArray(),
    notions: await db.notions.toArray(),
    projectYarns: await db.projectYarns.toArray(),
  };
  return data;
}

export async function importAll(data: any) {
  await db.transaction('rw', [db.projects, db.patterns, db.yarns, db.needles, db.notions, db.projectYarns], async () => {
    if (data.projects) await db.projects.bulkPut(data.projects);
    if (data.patterns) await db.patterns.bulkPut(data.patterns);
    if (data.yarns) await db.yarns.bulkPut(data.yarns);
    if (data.needles) await db.needles.bulkPut(data.needles);
    if (data.notions) await db.notions.bulkPut(data.notions);
    if (data.projectYarns) await db.projectYarns.bulkPut(data.projectYarns);
  });
}

export async function clearAll() {
  await db.transaction('rw', [db.projects, db.patterns, db.yarns, db.needles, db.notions, db.projectYarns], async () => {
    await Promise.all([
      db.projects.clear(),
      db.patterns.clear(),
      db.yarns.clear(),
      db.needles.clear(),
      db.notions.clear(),
      db.projectYarns.clear(),
    ]);
  });
}
