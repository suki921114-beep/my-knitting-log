import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import PageHeader from '@/components/PageHeader';
import { db } from '@/lib/db';
import { Layers, Scroll, Ruler, Sparkles, ChevronRight } from 'lucide-react';

export default function LibraryHub() {
  const counts = useLiveQuery(async () => ({
    yarns: await db.yarns.count(),
    patterns: await db.patterns.count(),
    needles: await db.needles.count(),
    notions: await db.notions.count(),
  }), []) || { yarns: 0, patterns: 0, needles: 0, notions: 0 };

  const items = [
    { to: '/library/yarns', label: '실', count: counts.yarns, icon: Layers, accent: 'text-primary bg-primary-soft' },
    { to: '/library/patterns', label: '도안', count: counts.patterns, icon: Scroll, accent: 'text-accent-foreground bg-accent-soft' },
    { to: '/library/needles', label: '바늘', count: counts.needles, icon: Ruler, accent: 'text-primary bg-primary-soft' },
    { to: '/library/notions', label: '부자재', count: counts.notions, icon: Sparkles, accent: 'text-accent-foreground bg-accent-soft' },
  ];

  return (
    <div>
      <PageHeader title="라이브러리" />
      <ul className="space-y-2">
        {items.map(it => (
          <li key={it.to}>
            <Link
              to={it.to}
              className="card-soft flex items-center gap-3.5 p-4 transition active:scale-[0.99] hover:shadow-soft"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${it.accent}`}>
                <it.icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold text-foreground">{it.label}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{it.label} {it.count}개</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
