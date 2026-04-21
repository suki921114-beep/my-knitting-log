import { NavLink, Outlet } from 'react-router-dom';
import { Home, Notebook, Package, Settings } from 'lucide-react';

const tabs = [
  { to: '/', label: '홈', icon: Home, end: true },
  { to: '/projects', label: '프로젝트', icon: Notebook },
  { to: '/library', label: '라이브러리', icon: Package },
  { to: '/settings', label: '설정', icon: Settings },
];

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 pb-28 pt-6">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-card/85 backdrop-blur-md supports-[backdrop-filter]:bg-card/70">
        <div
          className="mx-auto max-w-2xl grid grid-cols-4"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              <t.icon className="h-[18px] w-[18px]" strokeWidth={isActiveStroke(t.to)} />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function isActiveStroke(_to: string) {
  return 1.75;
}
