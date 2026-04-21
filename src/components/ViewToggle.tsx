import { LayoutGrid, List } from 'lucide-react';
import type { ViewMode } from '@/hooks/useViewMode';

export default function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border bg-card p-0.5">
      <button
        type="button"
        onClick={() => onChange('list')}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
          value === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
        }`}
        aria-label="리스트 보기"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
          value === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
        }`}
        aria-label="앨범 보기"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
