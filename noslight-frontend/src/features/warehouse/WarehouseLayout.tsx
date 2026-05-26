// src/features/warehouse/WarehouseLayout.tsx
import { Outlet, useLocation } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";

const warehouseSidebarItems = [
  { label: "Dashboard", path: "/warehouse" },
  { label: "Stock Materia Prima", path: "/warehouse/stock/raw" },
  { label: "Stock Producto Terminado", path: "/warehouse/stock/finished" },
  { label: "Transformar", path: "/warehouse/transform" },
  { label: "Historial de Envíos", path: "/warehouse/transfers" },
  { label: "Enviar a Tienda", path: "/warehouse/send-to-store" },
  { label: "Reportar falla/merma", path: "/warehouse/ajustes" },
];

export default function WarehouseLayout() {
  const location = useLocation();

  const sidebarItemsWithActive = warehouseSidebarItems.map((item) => ({
    ...item,
    isActive: 
      item.path === location.pathname || 
      (item.path !== "/warehouse" && location.pathname.startsWith(item.path)),
  }));

  return (
    <AppLayout
      title="Panel de Almacén"
      sidebarItems={sidebarItemsWithActive}
    >
      <Outlet />
    </AppLayout>
  );
}