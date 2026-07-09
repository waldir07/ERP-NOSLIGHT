// src/features/store/StoreLayout.tsx
import { Outlet } from "react-router-dom";
import StoreSidebar from "../StoreSidebar"; // Ajusta la ruta si es necesario
import { LogisticsBar } from "./LogisticsBar"; // Ajusta la ruta hacia tu barra

export default function StoreLayout() {
  return (
    // 1. Usamos 'flex-col' para que la barra esté arriba y lo demás debajo
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      
      {/* 2. La barra de logística ocupa todo el ancho superior */}
      <LogisticsBar />
      
      {/* 3. Contenedor para el Sidebar y el Contenido */}
      <div className="flex flex-1 overflow-hidden">
        <StoreSidebar />
        
        {/* Contenido dinámico */}
        <main className="flex-1 overflow-y-auto relative">
          <div className="max-w-[1400px] mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}