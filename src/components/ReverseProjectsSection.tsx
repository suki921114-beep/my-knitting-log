import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { statusLabel, statusColor } from '@/lib/yarnCalc';

type Kind = 'pattern' | 'needle' | 'notion' | 'yarn';

export default function ReverseProjectsSection({ kind, refId }: { kind: Kind; refId?: number }) {
  const links = useLiveQuery(async () => {
    if (!refId) return [];
    if (kind === 'pattern') return db.projectPatterns.where('patternId').equals(refId).toArray();
    if (kind === 'needle') return db.projectNeedles.where('needleId').equals(refId).toArray();
    if (kind === 'notion') return db.projectNotions.where('notionId').equals(refId).toArray();
    return db.projectYarns.where('yarnId').equals(refId).toArray();
  }, [kind, refId]) || [];

  const projects = useLiveQuery(() => db.projects.toArray(), []) || [];
  const pmap = new Map(projects.map(p => [p.id!, p]));

  if (!refId) return null;

  return (
    <section>
      <h2 className="mb-2 px-1 font-serif text-base font-semibold text-ink">사용된 프로젝트</h2>
      {links.length === 0 ? (
        <p className="rounded-xl bg-secondary/50 px-3 py-4 text-center text-xs text-muted-foreground">
          아직 연결된 프로젝트가 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {links.map((l: any) => {
            const p = pmap.get(l.projectId);
            if (!p) return null;
            return (
              <li key={l.id}>
                <Link to={`/projects/${l.projectId}`} className="card-soft flex items-center justify-between p-3">
                  <span className="text-sm text-ink">{p.name}</span>
                  <span className={`chip ${statusColor(p.status)}`}>{statusLabel(p.status)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
