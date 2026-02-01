import { HashRouter, Routes, Route } from "react-router-dom";
import MainLayout from "@/layouts/MainLayout";
import HomePage from "@/pages/HomePage";
import ConfigPage from "@/pages/ConfigPage";
import DnsTesterPage from "@/pages/DnsTesterPage";
import SettingsPage from "@/pages/SettingsPage";
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
            <Route index element={<HomePage />} />
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
