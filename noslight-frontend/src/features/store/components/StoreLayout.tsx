// src/features/store/components/StoreLayout.tsx
import { Outlet } from "react-router-dom";
import StoreSidebar from "../StoreSidebar";

export default function StoreLayout() {
  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar fijo a la izquierda */}
      <StoreSidebar />

      {/* Contenido dinámico a la derecha */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}