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
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        {back && (
          <button
            onClick={() => nav(-1)}
            className="mt-1 -ml-2 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
            aria-label="뒤로"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="font-serif text-2xl font-semibold leading-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {right}
    </header>
  );
}
