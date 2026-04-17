import { Outlet } from "react-router-dom";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function DashboardLayout() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-hero-mesh">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <Sidebar />
        <div className="min-w-0 flex-1 p-3 sm:p-4 md:p-6 xl:p-8">
          <Topbar />
          <main className="mt-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
