import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { Layers, Scroll, Ruler, Sparkles, ChevronRight } from 'lucide-react';

const ITEMS = [
  { to: '/library/yarns', label: '실', tag: 'Yarn', icon: Layers, accent: 'text-primary bg-primary-soft' },
  { to: '/library/patterns', label: '도안', tag: 'Pattern', icon: Scroll, accent: 'text-accent-foreground bg-accent-soft' },
  { to: '/library/needles', label: '바늘', tag: 'Needle', icon: Ruler, accent: 'text-primary bg-primary-soft' },
  { to: '/library/notions', label: '부자재', tag: 'Notion', icon: Sparkles, accent: 'text-accent-foreground bg-accent-soft' },
];

export default function LibraryHub() {
  return (
    <div>
      <PageHeader title="라이브러리" />
      <ul className="space-y-2">
        {ITEMS.map(it => (
          <li key={it.to}>
            <Link to={it.to} className="card-soft flex items-center gap-3.5 p-4 hover:shadow-soft">
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${it.accent}`}>
                <it.icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="flex-1">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{it.tag}</div>
                <div className="text-[15px] font-bold text-foreground">{it.label}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
