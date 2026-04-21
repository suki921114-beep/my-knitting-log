import { LayoutGrid, List } from 'lucide-react';
import type { ViewMode } from '@/hooks/useViewMode';

export default function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5">
      <button
        type="button"
        onClick={() => onChange('list')}
        className={`flex items-center justify-center rounded-full px-2.5 py-1.5 text-xs transition-colors ${
          value === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
        }`}
        aria-label="리스트 보기"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={`flex items-center justify-center rounded-full px-2.5 py-1.5 text-xs transition-colors ${
          value === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
        }`}
        aria-label="앨범 보기"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
