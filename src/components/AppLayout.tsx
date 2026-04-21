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
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 pb-28 pt-6 animate-fade-in">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-card/90 backdrop-blur-xl">
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
                `flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-primary-soft' : ''}`}>
                    <t.icon className="h-[17px] w-[17px]" strokeWidth={isActive ? 2.2 : 1.75} />
                  </div>
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
