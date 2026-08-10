import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ----------------------------------------------------------------------------
// 프로젝트에 새 칸을 더했을 때 백업에서 빠지지 않게
// ----------------------------------------------------------------------------
// 다른 항목(실·도안·바늘·부자재)은 통째로 복사해서 올린다. 그런데 프로젝트만은
// 칸을 하나씩 적어 payload 를 만든다 — 카운터·게이지·사진처럼 딸린 표가 있어서
// 그대로 올릴 수가 없기 때문이다.
//
// 그러다 보니 프로젝트에 칸을 더하고 payload 에 적는 걸 잊으면, 그 값은
// 영영 백업되지 않는다. 실제로 memo 가 그랬다 — 기기에는 잘 저장되고
// 화면에도 보이는데 클라우드에만 안 올라가서, 기기를 바꾸면 사라졌다.
//
// 이 검사는 두 목록을 맞춰 본다. 새 칸을 더하면 여기서 먼저 걸린다.

function read(rel: string) {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
}

/** 백업에 담지 않아도 되는 칸과 그 이유 */
const NOT_IN_PAYLOAD: Record<string, string> = {
  id: '기기 안에서만 쓰는 번호. 기기마다 달라 올릴 수 없다.',
  patternId: '도안 연결이 링크 표로 옮겨가기 전에 쓰던 옛 칸.',
  photos: '사진은 Storage 로 따로 보내고 payload 의 photos 로 자리만 적는다.',
};

function projectFields(): string[] {
  const src = read('../lib/db.ts');
  const start = src.indexOf('export interface Project extends SyncMetadata');
  const body = src.slice(start, src.indexOf('\n}', start));
  return [...body.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*)\??:/gm)].map(m => m[1]);
}

function payloadFields(): string[] {
  const src = read('../lib/sync/project.ts');
  const start = src.indexOf('\n  return {\n    cloudId: project.cloudId,');
  const body = src.slice(start, src.indexOf('\n  };', start));
  return [...body.matchAll(/^ {4}([a-zA-Z][a-zA-Z0-9]*):/gm)].map(m => m[1]);
}

describe('프로젝트 백업 payload', () => {
  it('프로젝트의 모든 칸이 백업에 담긴다', () => {
    const inPayload = new Set(payloadFields());
    const missing = projectFields().filter(
      f => !inPayload.has(f) && !(f in NOT_IN_PAYLOAD),
    );

    // 새 칸을 더했다면 sync/project.ts 의 payload 에도 적어야 한다.
    // 정말 안 올려도 되는 칸이라면 위 NOT_IN_PAYLOAD 에 이유와 함께 적을 것.
    expect(missing).toEqual([]);
  });

  it('읽어들이는 쪽에도 같은 칸이 있다', () => {
    // 올리기만 하고 받아오지 않으면, 기기를 바꿨을 때 값이 안 돌아온다
    const src = read('../lib/sync/project.ts');
    const start = src.indexOf('const baseProjectData = {');
    const body = src.slice(start, src.indexOf('\n    };', start));
    for (const f of ['name', 'status', 'progressNote', 'finishedNote', 'memo']) {
      expect(body).toContain(`${f}: remote.${f}`);
    }
  });

  it('딸린 표들도 모든 칸이 담긴다', () => {
    // 카운터·게이지·연결도 같은 방식으로 칸을 하나씩 적는다.
    // 프로젝트만 챙기고 이쪽을 놓치면 똑같은 일이 난다.
    const src = read('../lib/sync/project.ts');

    const cases: { entity: string; push: string; skip: string[] }[] = [
      { entity: 'RowCounter', push: 'rowCounterPayloads.push({', skip: ['id', 'projectId'] },
      { entity: 'ProjectGauge', push: 'gaugePayloads.push({', skip: ['id', 'projectId'] },
      // 연결은 상대를 번호가 아니라 cloudId 로 가리킨다
      { entity: 'ProjectYarn', push: 'yarnLinks.push({', skip: ['id', 'projectId', 'yarnId'] },
      { entity: 'ProjectPattern', push: 'patternLinks.push({', skip: ['id', 'projectId', 'patternId'] },
      { entity: 'ProjectNeedle', push: 'needleLinks.push({', skip: ['id', 'projectId', 'needleId'] },
      { entity: 'ProjectNotion', push: 'notionLinks.push({', skip: ['id', 'projectId', 'notionId'] },
    ];

    for (const c of cases) {
      const start = src.indexOf(c.push);
      expect(start, `${c.push} 를 찾지 못했습니다`).toBeGreaterThan(0);
      const body = src.slice(start, src.indexOf('});', start));

      const dbSrc = read('../lib/db.ts');
      const ds = dbSrc.indexOf(`export interface ${c.entity} extends SyncMetadata`);
      const decl = dbSrc.slice(ds, dbSrc.indexOf('\n}', ds));
      const fields = [...decl.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*)\??:/gm)].map(m => m[1]);

      const missing = fields.filter(f => !c.skip.includes(f) && !body.includes(`${f}:`));
      expect(missing, `${c.entity} 의 칸이 백업에서 빠졌습니다`).toEqual([]);
    }
  });

  it('검사가 헛돌지 않는지 — 목록을 실제로 읽어냈다', () => {
    // 정규식이 안 맞아 빈 목록이 되면 위 검사가 늘 통과해 버린다
    expect(projectFields().length).toBeGreaterThan(8);
    expect(payloadFields().length).toBeGreaterThan(8);
    expect(projectFields()).toContain('memo');
    expect(payloadFields()).toContain('memo');
  });
});
