import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import Home from "./pages/Home";
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
import GaugeCalculator from "./pages/GaugeCalculator";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/new" element={<ProjectForm />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/projects/:id/edit" element={<ProjectForm />} />
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
            <Route path="/tools/gauge" element={<GaugeCalculator />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
