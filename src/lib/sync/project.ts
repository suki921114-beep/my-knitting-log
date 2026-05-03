// ----------------------------------------------------------------------------
// Project (프로젝트) 동기화
// ----------------------------------------------------------------------------
// 프로젝트 본문 + 연결관계(yarn/pattern/needle/notion) + rowCounters + gauges
// 까지 하나의 Firestore 문서로 묶어서 동기화한다.

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { firestore } from '../firebase';
import { db } from '@/lib/db';
import type { GaugeMode, Project, ProjectPhoto } from '@/lib/db';
import { uploadPhotoDataUrl, downloadPhotoAsDataUrl } from './photoStorage';
import { ENABLE_CLOUD_PHOTO_SYNC } from '@/lib/featureFlags';
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

  notionLinks: Array<{
    cloudId: string;
    notionCloudId: string;
    quantity?: number;
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

  gauges: Array<{
    cloudId: string;
    name: string;
    mode?: GaugeMode;
    patternStitches: number;
    patternRows: number;
    myStitches: number;
    myRows: number;
    targetCm: number;
    patternTargetStitches?: number;
    patternTargetRows?: number;
    resultStitches: number;
    resultRows: number;
    memo?: string;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
    deletedAt: number | null;
  }>;

  /**
   * 사진 메타데이터. 원본 이미지(dataUrl) 는 Firestore 에 절대 안 들어가고
   * Firebase Storage 의 storagePath 만 보낸다. 다른 기기에서 가져오기 시 이
   * storagePath 로 Storage 에서 다운로드 후 로컬 dataUrl 캐시.
   */
  photos: Array<{
    cloudId: string;
    storagePath: string;
    contentType?: string;
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
  toUpload: number[];
  toDownload: ProjectSyncPayload[];
  unchanged: number;
};

export type ProjectFetchDiff = {
  toAdd: ProjectSyncPayload[];
  toUpdate: ProjectSyncPayload[];
  unchanged: number;
};

export async function buildProjectSyncPayload(projectId: number, userId: string): Promise<ProjectSyncPayload> {
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
    projectGauges,
  ] = await Promise.all([
    db.projectYarns.where("projectId").equals(projectId).toArray(),
    db.projectPatterns.where("projectId").equals(projectId).toArray(),
    db.projectNeedles.where("projectId").equals(projectId).toArray(),
    db.projectNotions.where("projectId").equals(projectId).toArray(),
    db.rowCounters.where("projectId").equals(projectId).toArray(),
    db.projectGauges.where("projectId").equals(projectId).toArray(),
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

  // ProjectGauge: rowCounters와 동일한 패턴으로 cloudId/타임스탬프 보정 후 payload 생성
  const gaugePayloads: ProjectSyncPayload["gauges"] = [];
  for (const gauge of projectGauges) {
    const fixUpdates: any = {};
    let needsLocalUpdate = false;
    if (!gauge.cloudId) {
      fixUpdates.cloudId = crypto.randomUUID();
      gauge.cloudId = fixUpdates.cloudId;
      needsLocalUpdate = true;
    }
    if (!gauge.createdAt) {
      fixUpdates.createdAt = Date.now();
      gauge.createdAt = fixUpdates.createdAt;
      needsLocalUpdate = true;
    }
    if (!gauge.updatedAt || Number.isNaN(gauge.updatedAt)) {
      fixUpdates.updatedAt = Date.now();
      gauge.updatedAt = fixUpdates.updatedAt;
      needsLocalUpdate = true;
    }
    if (gauge.isDeleted === undefined) {
      fixUpdates.isDeleted = false;
      gauge.isDeleted = false;
      needsLocalUpdate = true;
    }
    if (gauge.deletedAt === undefined) {
      fixUpdates.deletedAt = null;
      gauge.deletedAt = null;
      needsLocalUpdate = true;
    }
    if (needsLocalUpdate && gauge.id) {
      await db.projectGauges.update(gauge.id, fixUpdates);
    }
    gaugePayloads.push({
      cloudId: gauge.cloudId!,
      name: gauge.name,
      mode: gauge.mode,
      patternStitches: gauge.patternStitches,
      patternRows: gauge.patternRows,
      myStitches: gauge.myStitches,
      myRows: gauge.myRows,
      targetCm: gauge.targetCm,
      patternTargetStitches: gauge.patternTargetStitches,
      patternTargetRows: gauge.patternTargetRows,
      resultStitches: gauge.resultStitches,
      resultRows: gauge.resultRows,
      memo: gauge.memo,
      createdAt: gauge.createdAt,
      updatedAt: gauge.updatedAt,
      isDeleted: gauge.isDeleted ?? false,
      deletedAt: gauge.deletedAt ?? null,
    });
  }


  // ---- 사진 처리 ----
  // 플래그 ENABLE_CLOUD_PHOTO_SYNC 가 false 면 Storage 업로드/메타 빌드를 모두
  // 스킵하고 photoPayloads 를 빈 배열로 둔다. 로컬 photos 는 그대로 보존.
  const localPhotos: ProjectPhoto[] = (project.photos as any) || [];
  const updatedPhotos: ProjectPhoto[] = [];
  const photoPayloads: ProjectSyncPayload["photos"] = [];

  if (ENABLE_CLOUD_PHOTO_SYNC) for (const ph of localPhotos) {
    const photo: ProjectPhoto = {
      cloudId: ph.cloudId || crypto.randomUUID(),
      dataUrl: ph.dataUrl,
      storagePath: ph.storagePath,
      contentType: ph.contentType,
      createdAt: ph.createdAt || Date.now(),
      updatedAt: ph.updatedAt || Date.now(),
      isDeleted: ph.isDeleted ?? false,
      deletedAt: ph.deletedAt ?? null,
    };

    // 신규 사진 — Storage 업로드
    if (!photo.storagePath && photo.dataUrl) {
      try {
        photo.storagePath = await uploadPhotoDataUrl(userId, project.cloudId!, photo);
        photo.updatedAt = Date.now();
      } catch (e) {
        console.error('[Project Sync] 사진 업로드 실패:', e);
        // storagePath 없는 채로 보존 — 다음 백업 때 재시도
      }
    }

    updatedPhotos.push(photo);

    // Firestore payload 에는 storagePath 가 있는 (= 클라우드에 올라간) 사진만 포함
    if (photo.storagePath) {
      photoPayloads.push({
        cloudId: photo.cloudId,
        storagePath: photo.storagePath,
        contentType: photo.contentType,
        createdAt: photo.createdAt,
        updatedAt: photo.updatedAt,
        isDeleted: photo.isDeleted ?? false,
        deletedAt: photo.deletedAt ?? null,
      });
    }
  }

  // 로컬 DB 의 photos 메타 갱신 (cloudId / storagePath 가 채워진 상태로)
  // 플래그 false 면 updatedPhotos 가 비어 있으므로 update 하지 않는다 (로컬 보존)
  if (ENABLE_CLOUD_PHOTO_SYNC && (updatedPhotos.length || (project.photos && project.photos.length))) {
    await db.projects.update(projectId, { photos: updatedPhotos } as any);
  }


  const projectPayloadUpdatedAt = Math.max(
    project.updatedAt ?? 0,
    ...projectYarns.map(x => x.updatedAt ?? 0),
    ...projectPatterns.map(x => x.updatedAt ?? 0),
    ...projectNeedles.map(x => x.updatedAt ?? 0),
    ...projectNotions.map(x => x.updatedAt ?? 0),
    ...rowCounterPayloads.map(x => x.updatedAt ?? 0),
    ...gaugePayloads.map(x => x.updatedAt ?? 0),
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
    gauges: gaugePayloads,
    photos: photoPayloads,
  };
}

async function getProjectLocalSyncUpdatedAt(projectId: number, fallback = 0) {
  const [
    projectYarns,
    projectPatterns,
    projectNeedles,
    projectNotions,
    rowCounters,
    projectGauges,
  ] = await Promise.all([
    db.projectYarns.where("projectId").equals(projectId).toArray(),
    db.projectPatterns.where("projectId").equals(projectId).toArray(),
    db.projectNeedles.where("projectId").equals(projectId).toArray(),
    db.projectNotions.where("projectId").equals(projectId).toArray(),
    db.rowCounters.where("projectId").equals(projectId).toArray(),
    db.projectGauges.where("projectId").equals(projectId).toArray(),
  ]);
  return Math.max(
    fallback,
    ...projectYarns.map(x => x.updatedAt ?? 0),
    ...projectPatterns.map(x => x.updatedAt ?? 0),
    ...projectNeedles.map(x => x.updatedAt ?? 0),
    ...projectNotions.map(x => x.updatedAt ?? 0),
    ...rowCounters.map(x => x.updatedAt ?? 0),
    ...projectGauges.map(x => x.updatedAt ?? 0),
  );
}


async function mergeRemotePhotos(
  remotePhotos: ProjectSyncPayload['photos'],
  existingByCloudId: Map<string, ProjectPhoto>,
): Promise<ProjectPhoto[]> {
  const merged: ProjectPhoto[] = [];
  for (const remotePh of remotePhotos) {
    const cached = existingByCloudId.get(remotePh.cloudId);
    let dataUrl = cached?.dataUrl;
    if (!dataUrl && remotePh.storagePath) {
      try {
        dataUrl = await downloadPhotoAsDataUrl(remotePh.storagePath);
      } catch (e) {
        console.error('[Project Fetch] 사진 다운로드 실패:', remotePh.storagePath, e);
      }
    }
    merged.push({
      cloudId: remotePh.cloudId,
      dataUrl,
      storagePath: remotePh.storagePath,
      contentType: remotePh.contentType,
      createdAt: remotePh.createdAt,
      updatedAt: remotePh.updatedAt,
      isDeleted: remotePh.isDeleted ?? false,
      deletedAt: remotePh.deletedAt ?? null,
    });
  }
  return merged;
}

async function upsertProjectFromCloud(remote: ProjectSyncPayload) {
  // 사진 다운로드는 IDB 외부 fetch 라 트랜잭션 도중 await 시 트랜잭션이 자동
  // 종료됨. 현재 ENABLE_CLOUD_PHOTO_SYNC=false 라 mergeRemotePhotos 가 호출되지
  // 않아 외부 await 가 없으므로 트랜잭션 안에서 안전. 향후 true 로 켜질 때는
  // photos 처리만 트랜잭션 밖으로 빼야 한다 (TODO).
  await db.transaction(
    'rw',
    [
      db.projects,
      db.projectYarns,
      db.projectPatterns,
      db.projectNeedles,
      db.projectNotions,
      db.rowCounters,
      db.projectGauges,
      db.yarns,
      db.patterns,
      db.needles,
      db.notions,
    ],
    async () => {
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
    // 기존 로컬 사진 (dataUrl 캐시 보존용 — 이미 받은 사진 재다운로드 방지)
    const existingPhotos: ProjectPhoto[] = (existing?.photos as any) || [];
    const existingByCloudId = new Map<string, ProjectPhoto>(
      existingPhotos.filter(p => p.cloudId).map(p => [p.cloudId, p]),
    );

    // remote.photos 메타 + 로컬 캐시 병합
    // 플래그 false 면 remote.photos 무시하고 기존 로컬 photos 그대로 보존
    // (가져오기 때문에 사진이 사라지는 일 방지)
    const mergedPhotos: ProjectPhoto[] = ENABLE_CLOUD_PHOTO_SYNC
      ? await mergeRemotePhotos(remote.photos || [], existingByCloudId)
      : existingPhotos;

    if (existing) {
      await db.projects.update(existing.id!, {
        ...baseProjectData,
        id: existing.id,
        photos: mergedPhotos,
      } as any);
      projectId = existing.id!;
    } else {
      projectId = await db.projects.add({
        ...baseProjectData,
        photos: mergedPhotos.length ? mergedPhotos : undefined,
      } as any);
    }

    const [
      oldYarns,
      oldPatterns,
      oldNeedles,
      oldNotions,
      oldRowCounters,
      oldGauges,
    ] = await Promise.all([
      db.projectYarns.where("projectId").equals(projectId).toArray(),
      db.projectPatterns.where("projectId").equals(projectId).toArray(),
      db.projectNeedles.where("projectId").equals(projectId).toArray(),
      db.projectNotions.where("projectId").equals(projectId).toArray(),
      db.rowCounters.where("projectId").equals(projectId).toArray(),
      db.projectGauges.where("projectId").equals(projectId).toArray(),
    ]);

    // 링크 테이블(yarn/pattern/needle/notion)은 종래대로 bulkDelete 후 재생성.
    // 사용자 시점에서 직접적인 라이프사이클이 없고 프로젝트 단위로 갱신되므로
    // 부활/유실 리스크가 적다.
    if (oldYarns.length) await db.projectYarns.bulkDelete(oldYarns.map(x => x.id!).filter(Boolean));
    if (oldPatterns.length) await db.projectPatterns.bulkDelete(oldPatterns.map(x => x.id!).filter(Boolean));
    if (oldNeedles.length) await db.projectNeedles.bulkDelete(oldNeedles.map(x => x.id!).filter(Boolean));
    if (oldNotions.length) await db.projectNotions.bulkDelete(oldNotions.map(x => x.id!).filter(Boolean));

    // rowCounters / projectGauges 는 per-cloudId 병합.
    //   - 사용자가 단수 카운터를 누르거나 게이지 메모를 수정하는 빈도가 매우 잦고,
    //     소프트 삭제도 사용자 액션이라 fetch 시 부활하면 데이터 신뢰도가 흔들린다.
    //   - 로컬 updatedAt > 원격 updatedAt 이면 로컬을 보존(skip),
    //     아니면 update/add 로 원격 상태를 반영.
    //   - 원격에 없고 로컬에만 존재하는 항목(cloudId 없거나 원격 누락)은 보존.
    //     (clearAll/Trash purge 외에는 하드 삭제가 일어나지 않는 모델)
    const oldRowCounterByCloudId = new Map(
      oldRowCounters.filter(c => c.cloudId).map(c => [c.cloudId!, c]),
    );
    const oldGaugeByCloudId = new Map(
      oldGauges.filter(g => g.cloudId).map(g => [g.cloudId!, g]),
    );

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

    for (const counter of remote.rowCounters || []) {
      const cloudId = counter.cloudId || crypto.randomUUID();
      const existingLocal = counter.cloudId ? oldRowCounterByCloudId.get(counter.cloudId) : undefined;

      // 로컬이 더 최신이면 보존 — 사용자가 막 누른 카운터/소프트 삭제 보호
      if (
        existingLocal &&
        existingLocal.id != null &&
        (existingLocal.updatedAt ?? 0) > (counter.updatedAt ?? 0)
      ) {
        continue;
      }

      const counterData = {
        projectId,
        name: counter.name,
        count: counter.count ?? 0,
        goal: counter.goal,
        cloudId,
        createdAt: counter.createdAt ?? Date.now(),
        updatedAt: counter.updatedAt ?? Date.now(),
        isDeleted: counter.isDeleted ?? false,
        deletedAt: counter.deletedAt ?? null,
      };

      if (existingLocal && existingLocal.id != null) {
        await db.rowCounters.update(existingLocal.id, counterData as any);
      } else {
        await db.rowCounters.add(counterData as any);
      }
    }

    for (const gauge of remote.gauges || []) {
      const cloudId = gauge.cloudId || crypto.randomUUID();
      const existingLocal = gauge.cloudId ? oldGaugeByCloudId.get(gauge.cloudId) : undefined;

      // 로컬이 더 최신이면 보존 — 메모/계산값 수정 또는 소프트 삭제 보호
      if (
        existingLocal &&
        existingLocal.id != null &&
        (existingLocal.updatedAt ?? 0) > (gauge.updatedAt ?? 0)
      ) {
        continue;
      }

      const gaugeData = {
        projectId,
        name: gauge.name,
        mode: gauge.mode,
        patternStitches: gauge.patternStitches,
        patternRows: gauge.patternRows,
        myStitches: gauge.myStitches,
        myRows: gauge.myRows,
        targetCm: gauge.targetCm,
        patternTargetStitches: gauge.patternTargetStitches,
        patternTargetRows: gauge.patternTargetRows,
        resultStitches: gauge.resultStitches,
        resultRows: gauge.resultRows,
        memo: gauge.memo,
        cloudId,
        createdAt: gauge.createdAt ?? Date.now(),
        updatedAt: gauge.updatedAt ?? Date.now(),
        isDeleted: gauge.isDeleted ?? false,
        deletedAt: gauge.deletedAt ?? null,
      };

      if (existingLocal && existingLocal.id != null) {
        await db.projectGauges.update(existingLocal.id, gaugeData as any);
      } else {
        await db.projectGauges.add(gaugeData as any);
      }
    }
    },
  );
}
export async function calculateProjectSyncDiff(userId: string): Promise<ProjectSyncDiff> {
  const diff: ProjectSyncDiff = { toUpload: [], toDownload: [], unchanged: 0 };
  const localProjects = await db.projects.toArray();
  const localMap = new Map(localProjects.filter(p => p.cloudId).map(p => [p.cloudId!, p]));
  const projectsRef = collection(firestore, `users/${userId}/projects`);
  const snapshot = await getDocs(projectsRef);
  const remoteProjects = snapshot.docs.map(d => d.data() as ProjectSyncPayload);
  const remoteMap = new Map(remoteProjects.filter(p => p.cloudId).map(p => [p.cloudId, p]));

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
      const localSyncUpdatedAt = await getProjectLocalSyncUpdatedAt(local.id, local.updatedAt ?? 0);
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
  const localMap = new Map(localProjects.filter(p => p.cloudId).map(p => [p.cloudId!, p]));
  const projectsRef = collection(firestore, `users/${userId}/projects`);
  const snapshot = await getDocs(projectsRef);
  const remoteProjects = snapshot.docs.map(d => d.data() as ProjectSyncPayload);

  for (const remote of remoteProjects) {
    if (!remote.cloudId) continue;
    const local = localMap.get(remote.cloudId);
    if (!local) {
      diff.toAdd.push(remote);
    } else {
      const localSyncUpdatedAt = await getProjectLocalSyncUpdatedAt(local.id!, local.updatedAt ?? 0);
      if ((remote.updatedAt ?? 0) > localSyncUpdatedAt) {
        diff.toUpdate.push(remote);
      } else {
        diff.unchanged++;
      }
    }
  }
  return diff;
}

export async function executeProjectSync(userId: string, diff: ProjectSyncDiff): Promise<SyncResult> {
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
          await 