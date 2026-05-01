// ----------------------------------------------------------------------------
// Project (프로젝트) 동기화
// ----------------------------------------------------------------------------
// 프로젝트 본문 + 연결관계(yarn/pattern/needle/notion) + rowCounters 까지
// 하나의 Firestore 문서로 묶어서 동기화한다.
// 동작은 기존 src/lib/sync.ts 와 동일.

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { firestore } from '../firebase';
import { db } from '@/lib/db';
import type { Project } from '@/lib/db';
import {
  sanitizeForFirestore,
  type FetchResult,
  type SyncResult,
} from './common';

type ProjectSyncPayload = {
  cloudId: string;
  name: string;
  status: Project["status"];
  startDate?: string;
  endDate?: string;
  size?: string;
  gauge?: string;
  progressNote?: string;
  finishedNote?: string;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
  deletedAt: number | null;

  yarnLinks: Array<{
    cloudId: string;
    yarnCloudId: string;
    usedGrams: number;
    plannedGrams?: number;
    colorNote?: string;
    usageNote?: string;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
    deletedAt: number | null;
  }>;

  patternLinks: Array<{
    cloudId: string;
    patternCloudId: string;
    note?: string;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
    deletedAt: number | null;
  }>;

  needleLinks: Array<{
    cloudId: string;
    needleCloudId: string;
    note?: string;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
    deletedAt: number | null;
  }>;

  rowCounters: Array<{
    cloudId: string;
    name: string;
    count: number;
    goal?: number;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
    deletedAt: number | null;
  }>;
};

function cleanProjectText(value?: string) {
  return value && value.trim() ? value : undefined;
}

export type ProjectSyncDiff = {
  toUpload: number[]; // local project id 목록
  toDownload: ProjectSyncPayload[]; // remote project 문서 목록
  unchanged: number;
};

export type ProjectFetchDiff = {
  toAdd: ProjectSyncPayload[];
  toUpdate: ProjectSyncPayload[];
  unchanged: number;
};

export async function buildProjectSyncPayload(projectId: number): Promise<ProjectSyncPayload> {
  const project = await db.projects.get(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  if (!project.cloudId) {
    throw new Error(`Project ${projectId} has no cloudId`);
  }

  const [
    projectYarns,
    projectPatterns,
    projectNeedles,
    projectNotions,
    rowCounters,
  ] = await Promise.all([
    db.projectYarns.where("projectId").equals(projectId).toArray(),
    db.projectPatterns.where("projectId").equals(projectId).toArray(),
    db.projectNeedles.where("projectId").equals(projectId).toArray(),
    db.projectNotions.where("projectId").equals(projectId).toArray(),
    db.rowCounters.where("projectId").equals(projectId).toArray(),
  ]);

  const yarnLinks: ProjectSyncPayload["yarnLinks"] = [];
  for (const link of projectYarns) {
    const yarn = await db.yarns.get(link.yarnId);
    if (!yarn?.cloudId) continue;

    yarnLinks.push({
      cloudId: link.cloudId!,
      yarnCloudId: yarn.cloudId,
      usedGrams: link.usedGrams,
      plannedGrams: link.plannedGrams,
      colorNote: cleanProjectText(link.colorNote),
      usageNote: cleanProjectText(link.usageNote),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    });
  }

  const patternLinks: ProjectSyncPayload["patternLinks"] = [];
  for (const link of projectPatterns) {
    const pattern = await db.patterns.get(link.patternId);
    if (!pattern?.cloudId) continue;

    patternLinks.push({
      cloudId: link.cloudId!,
      patternCloudId: pattern.cloudId,
      note: cleanProjectText(link.note),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    });
  }

  const needleLinks: ProjectSyncPayload["needleLinks"] = [];
  for (const link of projectNeedles) {
    const needle = await db.needles.get(link.needleId);
    if (!needle?.cloudId) continue;

    needleLinks.push({
      cloudId: link.cloudId!,
      needleCloudId: needle.cloudId,
      note: cleanProjectText(link.note),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    });
  }

  const notionLinks: ProjectSyncPayload["notionLinks"] = [];
  for (const link of projectNotions) {
    const notion = await db.notions.get(link.notionId);
    if (!notion?.cloudId) continue;

    notionLinks.push({
      cloudId: link.cloudId!,
      notionCloudId: notion.cloudId,
      quantity: link.quantity,
      note: cleanProjectText(link.note),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    });
  }

  const rowCounterPayloads: ProjectSyncPayload["rowCounters"] = [];

  for (const counter of rowCounters) {
    const fixUpdates: any = {};
    let needsLocalUpdate = false;

    if (!counter.cloudId) {
      fixUpdates.cloudId = crypto.randomUUID();
      counter.cloudId = fixUpdates.cloudId;
      needsLocalUpdate = true;
    }

    if (!counter.createdAt) {
      fixUpdates.createdAt = Date.now();
      counter.createdAt = fixUpdates.createdAt;
      needsLocalUpdate = true;
    }

    if (!counter.updatedAt || Number.isNaN(counter.updatedAt)) {
      fixUpdates.updatedAt = Date.now();
      counter.updatedAt = fixUpdates.updatedAt;
      needsLocalUpdate = true;
    }

    if (counter.isDeleted === undefined) {
      fixUpdates.isDeleted = false;
      counter.isDeleted = false;
      needsLocalUpdate = true;
    }

    if (counter.deletedAt === undefined) {
      fixUpdates.deletedAt = null;
      counter.deletedAt = null;
      needsLocalUpdate = true;
    }

    if (needsLocalUpdate && counter.id) {
      await db.rowCounters.update(counter.id, fixUpdates);
    }

    rowCounterPayloads.push({
      cloudId: counter.cloudId!,
      name: counter.name,
      count: counter.count ?? 0,
      goal: counter.goal,
      createdAt: counter.createdAt,
      updatedAt: counter.updatedAt,
      isDeleted: counter.isDeleted ?? false,
      deletedAt: counter.deletedAt ?? null,
    });
  }

  const projectPayloadUpdatedAt = Math.max(
    project.updatedAt ?? 0,
    ...projectYarns.map(x => x.updatedAt ?? 0),
    ...projectPatterns.map(x => x.updatedAt ?? 0),
    ...projectNeedles.map(x => x.updatedAt ?? 0),
    ...projectNotions.map(x => x.updatedAt ?? 0),
    ...rowCounterPayloads.map(x => x.updatedAt ?? 0),
  );

  return {
    cloudId: project.cloudId,
    name: project.name,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    size: cleanProjectText(project.size),
    gauge: cleanProjectText(project.gauge),
    progressNote: cleanProjectText(project.progressNote),
    finishedNote: cleanProjectText(project.finishedNote),
    createdAt: project.createdAt,
    updatedAt: projectPayloadUpdatedAt,
    isDeleted: project.isDeleted ?? false,
    deletedAt: project.deletedAt ?? null,

    yarnLinks,
    patternLinks,
    needleLinks,
    notionLinks,
    rowCounters: rowCounterPayloads,
  };
}

async function getProjectLocalSyncUpdatedAt(projectId: number, fallback = 0) {
  const [
    projectYarns,
    projectPatterns,
    projectNeedles,
    projectNotions,
    rowCounters,
  ] = await Promise.all([
    db.projectYarns.where("projectId").equals(projectId).toArray(),
    db.projectPatterns.where("projectId").equals(projectId).toArray(),
    db.projectNeedles.where("projectId").equals(projectId).toArray(),
    db.projectNotions.where("projectId").equals(projectId).toArray(),
    db.rowCounters.where("projectId").equals(projectId).toArray(),
  ]);

  return Math.max(
    fallback,
    ...projectYarns.map(x => x.updatedAt ?? 0),
    ...projectPatterns.map(x => x.updatedAt ?? 0),
    ...projectNeedles.map(x => x.updatedAt ?? 0),
    ...projectNotions.map(x => x.updatedAt ?? 0),
    ...rowCounters.map(x => x.updatedAt ?? 0),
  );
}

async function upsertProjectFromCloud(remote: ProjectSyncPayload) {
  const existing = await db.projects.where("cloudId").equals(remote.cloudId).first();

  const baseProjectData = {
    name: remote.name,
    status: remote.status,
    startDate: remote.startDate,
    endDate: remote.endDate,
    size: remote.size,
    gauge: remote.gauge,
    progressNote: remote.progressNote,
    finishedNote: remote.finishedNote,
    cloudId: remote.cloudId,
    createdAt: remote.createdAt,
    updatedAt: remote.updatedAt,
    isDeleted: remote.isDeleted ?? false,
    deletedAt: remote.deletedAt ?? null,
  };

  let projectId: number;

  if (existing) {
    await db.projects.update(existing.id!, {
      ...baseProjectData,
      id: existing.id,
      // 1차에서는 photos는 클라우드에 안 올리므로 로컬 값 유지
      photos: existing.photos,
    } as any);
    projectId = existing.id!;
  } else {
    projectId = await db.projects.add({
      ...baseProjectData,
      photos: undefined,
    } as any);
  }

  // 기존 연결 전부 삭제 후 클라우드 기준으로 재구성
  const [oldYarns, oldPatterns, oldNeedles, oldNotions, oldRowCounters] = await Promise.all([
    db.projectYarns.where("projectId").equals(projectId).toArray(),
    db.projectPatterns.where("projectId").equals(projectId).toArray(),
    db.projectNeedles.where("projectId").equals(projectId).toArray(),
    db.projectNotions.where("projectId").equals(projectId).toArray(),
    db.rowCounters.where("projectId").equals(projectId).toArray(),
  ]);

  if (oldYarns.length) {
    await db.projectYarns.bulkDelete(oldYarns.map(x => x.id!).filter(Boolean));
  }
  if (oldPatterns.length) {
    await db.projectPatterns.bulkDelete(oldPatterns.map(x => x.id!).filter(Boolean));
  }
  if (oldNeedles.length) {
    await db.projectNeedles.bulkDelete(oldNeedles.map(x => x.id!).filter(Boolean));
  }
  if (oldNotions.length) {
    await db.projectNotions.bulkDelete(oldNotions.map(x => x.id!).filter(Boolean));
  }
  if (oldRowCounters.length) {
    await db.rowCounters.bulkDelete(oldRowCounters.map(x => x.id!).filter(Boolean));
  }

  // yarn links 복원
  for (const link of remote.yarnLinks || []) {
    const yarn = await db.yarns.where("cloudId").equals(link.yarnCloudId).first();
    if (!yarn?.id) continue;

    await db.projectYarns.add({
      projectId,
      yarnId: yarn.id,
      usedGrams: link.usedGrams,
      plannedGrams: link.plannedGrams,
      colorNote: link.colorNote,
      usageNote: link.usageNote,
      cloudId: link.cloudId,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    } as any);
  }

  // pattern links 복원
  for (const link of remote.patternLinks || []) {
    const pattern = await db.patterns.where("cloudId").equals(link.patternCloudId).first();
    if (!pattern?.id) continue;

    await db.projectPatterns.add({
      projectId,
      patternId: pattern.id,
      note: link.note,
      cloudId: link.cloudId,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    } as any);
  }

  // needle links 복원
  for (const link of remote.needleLinks || []) {
    const needle = await db.needles.where("cloudId").equals(link.needleCloudId).first();
    if (!needle?.id) continue;

    await db.projectNeedles.add({
      projectId,
      needleId: needle.id,
      note: link.note,
      cloudId: link.cloudId,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    } as any);
  }

  // notion links 복원
  for (const link of remote.notionLinks || []) {
    const notion = await db.notions.where("cloudId").equals(link.notionCloudId).first();
    if (!notion?.id) continue;

    await db.projectNotions.add({
      projectId,
      notionId: notion.id,
      quantity: link.quantity,
      note: link.note,
      cloudId: link.cloudId,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      isDeleted: link.isDeleted ?? false,
      deletedAt: link.deletedAt ?? null,
    } as any);
  }

  // row counters 복원
  for (const counter of remote.rowCounters || []) {
    await db.rowCounters.add({
      projectId,
      name: counter.name,
      count: counter.count ?? 0,
      goal: counter.goal,
      cloudId: counter.cloudId || crypto.randomUUID(),
      createdAt: counter.createdAt ?? Date.now(),
      updatedAt: counter.updatedAt ?? Date.now(),
      isDeleted: counter.isDeleted ?? false,
      deletedAt: counter.deletedAt ?? null,
    } as any);
  }
}

export async function calculateProjectSyncDiff(userId: string): Promise<ProjectSyncDiff> {
  const diff: ProjectSyncDiff = { toUpload: [], toDownload: [], unchanged: 0 };

  const localProjects = await db.projects.toArray();
  const localMap = new Map(
    localProjects.filter(p => p.cloudId).map(p => [p.cloudId!, p])
  );

  const projectsRef = collection(firestore, `users/${userId}/projects`);
  const snapshot = await getDocs(projectsRef);
  const remoteProjects = snapshot.docs.map(d => d.data() as ProjectSyncPayload);
  const remoteMap = new Map(
    remoteProjects.filter(p => p.cloudId).map(p => [p.cloudId, p])
  );

  for (const local of localProjects) {
    if (!local.id) continue;

    if (!local.cloudId) {
      diff.toUpload.push(local.id);
      continue;
    }

    const remote = remoteMap.get(local.cloudId);

    if (!remote) {
      diff.toUpload.push(local.id);
    } else {
      const localSyncUpdatedAt = await getProjectLocalSyncUpdatedAt(
        local.id,
        local.updatedAt ?? 0
      );

      if (localSyncUpdatedAt > (remote.updatedAt ?? 0)) {
        diff.toUpload.push(local.id);
      } else if (localSyncUpdatedAt < (remote.updatedAt ?? 0)) {
        diff.toDownload.push(remote);
      } else {
        diff.unchanged++;
      }
    }
  }

  for (const remote of remoteProjects) {
    if (!remote.cloudId) continue;
    if (!localMap.has(remote.cloudId)) {
      diff.toDownload.push(remote);
    }
  }

  return diff;
}

export async function calculateProjectFetchDiff(userId: string): Promise<ProjectFetchDiff> {
  const diff: ProjectFetchDiff = { toAdd: [], toUpdate: [], unchanged: 0 };

  const localProjects = await db.projects.toArray();
  const localMap = new Map(
    localProjects.filter(p => p.cloudId).map(p => [p.cloudId!, p])
  );

  const projectsRef = collection(firestore, `users/${userId}/projects`);
  const snapshot = await getDocs(projectsRef);
  const remoteProjects = snapshot.docs.map(d => d.data() as ProjectSyncPayload);

  for (const remote of remoteProjects) {
    if (!remote.cloudId) continue;

    const local = localMap.get(remote.cloudId);

    if (!local) {
      diff.toAdd.push(remote);
    } else {
      const localSyncUpdatedAt = await getProjectLocalSyncUpdatedAt(
        local.id!,
        local.updatedAt ?? 0
      );

      if ((remote.updatedAt ?? 0) > localSyncUpdatedAt) {
        diff.toUpdate.push(remote);
      } else {
        diff.unchanged++;
      }
    }
  }

  return diff;
}

export async function executeProjectSync(
  userId: string,
  diff: ProjectSyncDiff
): Promise<SyncResult> {
  let uploaded = 0;
  let downloaded = 0;
  let failed = 0;

  try {
    const batch = writeBatch(firestore);

    for (const localProjectId of diff.toUpload) {
      try {
        const localProject = await db.projects.get(localProjectId);
        if (!localProject) {
          failed++;
          continue;
        }

        const fixUpdates: any = {};
        let needsLocalUpdate = false;

        if (!localProject.cloudId) {
          fixUpdates.cloudId = crypto.randomUUID();
          needsLocalUpdate = true;
        }

        if (!localProject.createdAt) {
          fixUpdates.createdAt = Date.now();
          needsLocalUpdate = true;
        }

        if (!localProject.updatedAt || Number.isNaN(localProject.updatedAt)) {
          fixUpdates.updatedAt = Date.now();
          needsLocalUpdate = true;
        }

        if (localProject.isDeleted === undefined) {
          fixUpdates.isDeleted = false;
          needsLocalUpdate = true;
        }

        if (localProject.deletedAt === undefined) {
          fixUpdates.deletedAt = null;
          needsLocalUpdate = true;
        }

        if (needsLocalUpdate) {
          await db.projects.update(localProjectId, fixUpdates);
        }

        const payload = await buildProjectSyncPayload(localProjectId);
        const docRef = doc(firestore, `users/${userId}/projects`, payload.cloudId);

        const safePayload = sanitizeForFirestore(payload);

        console.log(`[Project Sync Upload] ${payload.name}`);
        console.log(`  - cloudId: ${payload.cloudId}`);
        console.log(`  - updatedAt: ${payload.updatedAt}`);
        console.log(`  - payload:`, payload);

        batch.set(docRef, safePayload);
        uploaded++;
      } catch (e) {
        console.error(`[Sync] Project 업로드 준비 실패: ${localProjectId}`, e);
        failed++;
      }
    }

    try {
      await batch.commit();
    } catch (batchError) {
      console.error("[Sync] Firestore Batch Commit 실패 (Project):", batchError);
      failed += uploaded;
      uploaded = 0;
    }

    for (const remote of diff.toDownload) {
      try {
        await upsertProjectFromCloud(remote);
        downloaded++;
      } catch (e) {
        console.error(`[Sync] Project 다운로드/저장 실패: ${remote.name} (${remote.cloudId})`, e);
        failed++;
      }
    }

    return {
      uploaded,
      downloaded,
      unchanged: diff.unchanged,
      failed,
    };
  } catch (error) {
    console.error("Project Sync execution error:", error);
    throw error;
  }
}

export async function executeProjectFetch(
  diff: ProjectFetchDiff
): Promise<FetchResult> {
  let added = 0;
  let updated = 0;
  let failed = 0;

  for (const remote of diff.toAdd) {
    try {
      await upsertProjectFromCloud(remote);
      added++;
    } catch (e) {
      console.error(`[Fetch] Project 추가 실패: ${remote.name} (${remote.cloudId})`, e);
      failed++;
    }
  }

  for (const remote of diff.toUpdate) {
    try {
      await upsertProjectFromCloud(remote);
      updated++;
    } catch (e) {
      console.error(`[Fetch] Project 덮어쓰기 실패: ${remote.name} (${remote.cloudId})`, e);
      failed++;
    }
  }

  return {
    added,
    updated,
    unchanged: diff.unchanged,
    failed,
  };
}
