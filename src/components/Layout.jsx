import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import TabBar from "./TabBar";
import { DadosProvider } from "../contexts/DadosContext";
import { HistoricoProvider } from "../contexts/HistoricoContext";

export default function Layout() {
  return (
    <DadosProvider>
      <HistoricoProvider>
      <div style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bg-soft)" }}>
        <TopBar />
        <div className="dashboard-layout" style={{ flex: 1 }}>
          <Sidebar />
          <Outlet />
        </div>
        <TabBar />
      </div>
      </HistoricoProvider>
    </DadosProvider>
  );
}
