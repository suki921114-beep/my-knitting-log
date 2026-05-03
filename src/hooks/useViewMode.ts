import { useEffect, useState } from 'react';

export type ViewMode = 'list' | 'grid';

export function useViewMode(key: string, initial: ViewMode = 'list') {
  const storageKey = `view-mode:${key}`;
  const [mode, setMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return initial;
    return (localStorage.getItem(storageKey) as ViewMode) || initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, mode);
    } catch {}
  }, [mode, storageKey]);
  return [mode, setMode] as const;
}
