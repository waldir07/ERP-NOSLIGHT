// src/routes/index.tsx
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  Link,
} from "react-router-dom";

import LoginForm from "@/features/auth/components/LoginForm"; // sin llaves si es default export
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Role } from "@/types/user";
import SendToStorePage from "@/features/warehouse/pages/SendToStorePage";
// 1. Importa la nueva página (ajusta la ruta si es diferente)
import InventoryAdjustmentPage from "@/features/inventory/pages/InventoryAdjustmentPage";
import InventoryAuditPage from "@/features/admin/components/InventoryAuditPage";
import AdminLayout from "@/features/admin/AdminLayout";
import WarehouseLayout from "@/features/warehouse/WarehouseLayout";
import StockList from "@/features/warehouse/components/StockList";
import TransformForm from "@/features/warehouse/components/TransformForm";
import AdminDashboardContent from "@/features/admin/components/AdminDashboardContent";
import AdminUsers from "@/features/admin/components/AdminUsers";
import AdminProducts from "@/features/admin/components/AdminProducts";
import ImportacionesPage from "@/features/admin/components/ImportacionesPage";
import WarehouseDashboardContent from "@/features/warehouse/components/WarehouseDashboardContent";
import TransferHistoryPage from "@/features/warehouse/components/TransferDetailModal";
import StoreRoutes from "@/features/store/StoreRoutes";
import CreditsPage from '@/features/store/components/CreditsPage'; // (Ajusta los puntitos según tu carpeta)
import CustomersPage from '@/features/admin/components/CustomersPage'; // Asegúrate de que la ruta coincida con tu carpeta


// Componente dummy (corrige la sintaxis)



function ProtectedRoute({ allowedRoles }: { allowedRoles: Role[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Cargando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

// src/routes/index.tsx
// ... imports iguales ...

const router = createBrowserRouter([
  { path: "/login", element: <LoginForm /> },

  {
    element: <ProtectedRoute allowedRoles={["ADMIN"]} />,
    children: [
      {
        path: "/admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboardContent /> },
          { path: "users", element: <AdminUsers /> },
          { path: "products", element: <AdminProducts /> },
          // ← NUEVA RUTA AQUÍ
          { path: "importaciones", element: <ImportacionesPage /> },
          { path: "auditoria-stock", element: <InventoryAuditPage /> },
          { path: "credits", element: <CreditsPage /> },
          { path: "customers", element: <CustomersPage /> },
          { path: "reports", element: <div>Reportes (en construcción)</div> },
          // Agrega más rutas aquí
        ],
      },
    ],
  },

  {
    element: <ProtectedRoute allowedRoles={["WAREHOUSE", "ADMIN"]} />,
    children: [
      {
        path: "/warehouse",
        element: <WarehouseLayout />,
        children: [
          { index: true, element: <WarehouseDashboardContent /> },
          // Tus rutas de warehouse
          { path: "stock/raw", element: <StockList type="raw" /> },
          { path: "stock/finished", element: <StockList type="finished" /> },
          { path: "transform", element: <TransformForm /> },
          { path: "send-to-store", element: <SendToStorePage /> }, // Deberás crear la página similar a la de ajustes
          { path: "transfers", element: <TransferHistoryPage /> },
          { path: "ajustes", element: <InventoryAdjustmentPage /> },

          // ...
        ],
      },
    ],
  },

  // Store
  {
    element: <ProtectedRoute allowedRoles={["STORE", "ADMIN"]} />, // Ambos pueden entrar
    children: [
      {
        path: "/store/*",
        element: <ProtectedRoute allowedRoles={["STORE", "ADMIN"]} />,
        children: [{ path: "*", element: <StoreRoutes /> }],
      },
    ],
  },

  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "*", element: <div>404 - Página no encontrada</div> },
]);

export default function AppRoutes() {
  return <RouterProvider router={router} />;
}
