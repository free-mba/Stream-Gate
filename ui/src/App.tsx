import { HashRouter, Routes, Route } from "react-router-dom";
import MainLayout from "@/layouts/MainLayout";
import HomePage from "@/pages/HomePage";
import ConfigPage from "@/pages/ConfigPage";
import DnsTesterPage from "@/pages/DnsTesterPage";
import SettingsPage from "@/pages/SettingsPage";

function App() {
  return (
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
  );
}

export default App;
