import { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}

export default function PageHeader({ title, subtitle, back, right }: Props) {
  const nav = useNavigate();
  return (
    <header className="mb-5 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1.5">
        {back && (
          <button
            onClick={() => nav(-1)}
            className="-ml-2 rounded-full p-2 text-muted-foreground hover:bg-secondary"
            aria-label="뒤로"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-extrabold leading-tight tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}
