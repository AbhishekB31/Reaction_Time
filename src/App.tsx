import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Consent from "./pages/Consent";
import ModeSelect from "./pages/ModeSelect";
import Play from "./pages/Play";
import RT60 from "./pages/RT60";
import CPS from "./pages/CPS";
import Stats from "./pages/Stats";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/consent" element={<Consent />} />
        <Route path="/modes" element={<ModeSelect />} />
        <Route path="/play" element={<Play />} />
        <Route path="/rt60" element={<RT60 />} />
        <Route path="/cps" element={<CPS />} />
        <Route path="/stats" element={<Stats />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
