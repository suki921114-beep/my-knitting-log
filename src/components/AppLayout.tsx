import { NavLink, Outlet } from 'react-router-dom';
import { Home, BookHeart, Notebook, Package, Settings } from 'lucide-react';
import { useAutoSync } from '@/hooks/useAutoSync';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';
import OfflineBanner from '@/components/OfflineBanner';

const tabs = [
  { to: '/', label: '홈', icon: Home, end: true },
  { to: '/diary', label: '다이어리', icon: BookHeart },
  { to: '/projects', label: '프로젝트', icon: Notebook },
  { to: '/library', label: '라이브러리', icon: Package },
  { to: '/settings', label: '설정', icon: Settings },
];

export default function AppLayout() {
  // 로그인 + 모드/네트워크 조건 충족 시 앱 진입 직후 한 번 자동 백업
  useAutoSync();
  // 안드로이드 하드웨어 뒤로가기 — 기본값은 앱 종료라 직접 처리한다
  useAndroidBackButton();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <OfflineBanner />
      {/*
        하단 탭바가 fixed 라 본문이 그 아래로 숨는다.
        탭바 높이(약 4.5rem) + 제스처 바(safe-area) + 여유 를 확보한다.
        페이지마다 따로 pb 를 주지 않아도 되도록 여기서 한 번에 처리.
      */}
      <main
        className="flex-1 mx-auto w-full max-w-2xl px-4 pt-6 animate-fade-in"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-card/90 backdrop-blur-xl">
        <div
          className="mx-auto max-w-2xl grid grid-cols-5"
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
