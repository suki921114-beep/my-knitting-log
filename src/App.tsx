import { lazy, Suspense } from "react";
import BugReport from "./pages/BugReport";
import ScrollToTop from "@/components/ScrollToTop";

// 개발용 화면 — 별도 청크로 분리되어 프로덕션에서는 로드되지 않는다.
const AiLog = lazy(() => import("./pages/AiLog"));
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Diary from "./pages/Diary";
import LogForm from "./pages/LogForm";
import Projects from "./pages/Projects";
import ProjectForm from "./pages/ProjectForm";
import ProjectDetail from "./pages/ProjectDetail";
import LibraryHub from "./pages/LibraryHub";
import Yarns from "./pages/Yarns";
import YarnForm from "./pages/YarnForm";
import YarnDetail from "./pages/YarnDetail";
import Patterns from "./pages/Patterns";
import PatternForm from "./pages/PatternForm";
import Needles from "./pages/Needles";
import NeedleForm from "./pages/NeedleForm";
import Notions from "./pages/Notions";
import NotionForm from "./pages/NotionForm";
import Settings from "./pages/Settings";
import Trash from "./pages/Trash";
import SettingsBackup from "./pages/SettingsBackup";
import SettingsData from "./pages/SettingsData";
import SettingsDeleteAccount from "./pages/SettingsDeleteAccount";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import About from "./pages/About";
import GaugeCalculator from "./pages/GaugeCalculator";
import KnitMode from "./pages/KnitMode";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login";
import { AuthProvider } from "./hooks/useAuth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
        <ScrollToTop />
        <ErrorBoundary>
          <Routes>
            {/* 개발용 AI 입력 실험 화면 — 로컬 Ollama 서버가 필요하므로
                프로덕션 빌드에서는 라우트를 등록하지 않는다 (URL 직접 접근 차단). */}
            {import.meta.env.DEV && (
              <Route
                path="/tools/ai-log"
                element={
                  <Suspense fallback={<p className="p-8 text-center text-sm">불러오는 중…</p>}>
                    <AiLog />
                  </Suspense>
                }
              />
            )}

            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
            <Route path="/diary" element={<Diary />} />
            <Route path="/diary/new" element={<LogForm />} />
            <Route path="/diary/:id/edit" element={<LogForm />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/new" element={<ProjectForm />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/projects/:id/edit" element={<ProjectForm />} />
            {/* 뜨기 모드 — 화면을 갈라 위는 카운터, 아래는 도안 */}
            <Route path="/projects/:id/knit" element={<KnitMode />} />
            <Route path="/library" element={<LibraryHub />} />
            <Route path="/library/yarns" element={<Yarns />} />
            <Route path="/library/yarns/new" element={<YarnForm />} />
            <Route path="/library/yarns/:id" element={<YarnDetail />} />
            <Route path="/library/yarns/:id/edit" element={<YarnForm />} />
            <Route path="/library/patterns" element={<Patterns />} />
            <Route path="/library/patterns/new" element={<PatternForm />} />
            <Route path="/library/patterns/:id/edit" element={<PatternForm />} />
            <Route path="/library/needles" element={<Needles />} />
            <Route path="/library/needles/new" element={<NeedleForm />} />
            <Route path="/library/needles/:id/edit" element={<NeedleForm />} />
            <Route path="/library/notions" element={<Notions />} />
            <Route path="/library/notions/new" element={<NotionForm />} />
            <Route path="/library/notions/:id/edit" element={<NotionForm />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/backup" element={<SettingsBackup />} />
            <Route path="/settings/data" element={<SettingsData />} />
            <Route path="/settings/trash" element={<Trash />} />
            <Route path="/settings/delete-account" element={<SettingsDeleteAccount />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/about" element={<About />} />
            <Route path="/tools/gauge" element={<GaugeCalculator />} />
            <Route path="/settings/bug-report" element={<BugReport />} />

          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </ErrorBoundary>
      </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
