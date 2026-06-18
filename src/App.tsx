import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ContractsProvider } from "@/context/ContractsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { HomePage } from "@/pages/HomePage";
import { MapPage } from "@/pages/MapPage";
import { ContractsPage } from "@/pages/ContractsPage";
import { HelpPage } from "@/pages/HelpPage";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <ThemeProvider>
    <ContractsProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="contracts" element={<ContractsPage />} />
            <Route path="map" element={<MapPage />} />
            <Route path="help" element={<HelpPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </ContractsProvider>
    </ThemeProvider>
  );
}
