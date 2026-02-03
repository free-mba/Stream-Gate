import { HashRouter, Routes, Route } from "react-router-dom";
import MainLayout from "@/layouts/MainLayout";
// Feature Pages
import ConnectionPage from "@/features/Connection/ConnectionPage";
import ConfigPage from "@/features/Config/ConfigPage";
import DnsTesterPage from "@/features/DnsTester/DnsTesterPage";
import SettingsPage from "@/features/Settings/SettingsPage";

import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { languageAtom, themeAtom } from "@/store";

function AppProviders({ children }: { children: React.ReactNode }) {
  const lang = useAtomValue(languageAtom);
  const theme = useAtomValue(themeAtom);

  useEffect(() => {
    // Handle Theme
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    // Handle Direction
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  return <>{children}</>;
}

function App() {
  return (
    <AppProviders>
      <HashRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<ConnectionPage />} />
            <Route path="configs" element={<ConfigPage />} />
            <Route path="dns" element={<DnsTesterPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProviders>
  );
}

export default App;
