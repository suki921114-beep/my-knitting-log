import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { Layers, Scroll, Ruler, Sparkles } from 'lucide-react';

const ITEMS = [
  { to: '/library/yarns', label: '실', desc: '재고와 사용처를 추적하세요', icon: Layers, tone: 'bg-warm/30' },
  { to: '/library/patterns', label: '도안', desc: '디자이너·출처·링크 보관', icon: Scroll, tone: 'bg-sage/25' },
  { to: '/library/needles', label: '바늘', desc: '대바늘·코바늘·줄바늘', icon: Ruler, tone: 'bg-accent/15' },
  { to: '/library/notions', label: '부자재', desc: '단추, 마커, 라벨…', icon: Sparkles, tone: 'bg-cream' },
];

export default function LibraryHub() {
  return (
    <div>
      <PageHeader title="라이브러리" subtitle="작업에 쓰는 재료들을 정리해요." />
      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map(it => (
          <Link key={it.to} to={it.to} className={`card-soft block p-4 ${it.tone}`}>
            <it.icon className="h-6 w-6 text-primary" />
            <div className="mt-3 font-serif text-lg font-semibold text-ink">{it.label}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{it.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
