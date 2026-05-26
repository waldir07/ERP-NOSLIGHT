// src/features/admin/components/AdminLayout.tsx
import { Outlet, useLocation } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";

const adminSidebarItems = [
  { label: "Dashboard", path: "/admin" },
  { label: "Usuarios", path: "/admin/users" },
  { label: "Productos", path: "/admin/products" },
  { label: "Importaciones", path: "/admin/importaciones" },   // ← NUEVO
  { label: "Auditoría de Stock", path: "/admin/auditoria-stock" },   // ← NUEVO
  { label: "Reportes", path: "/admin/reports" },
];

export default function AdminLayout() {
  const location = useLocation();

  const sidebarItemsWithActive = adminSidebarItems.map((item) => ({
    ...item,
    isActive: 
      item.path === location.pathname || 
      (item.path !== "/admin" && location.pathname.startsWith(item.path)),
  }));

  return (
    <AppLayout
      title="Panel de Administración"
      sidebarItems={sidebarItemsWithActive}
    >
      <Outlet />
    </AppLayout>
  );
}