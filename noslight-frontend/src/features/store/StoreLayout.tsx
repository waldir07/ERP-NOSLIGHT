import { Outlet } from "react-router-dom";
import StoreSidebar from "./StoreSidebar";

export default function StoreLayout() {
  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <StoreSidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Aquí es donde se renderizarán las páginas como ReceiveInventoryPage */}
        <Outlet />
      </main>
    </div>
  );
}