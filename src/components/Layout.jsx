import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <div style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar />
      <div className="dashboard-layout" style={{ flex: 1 }}>
        <Sidebar />
        <Outlet />
      </div>
    </div>
  );
}
