// src/layouts/AppLayout.tsx
import { ReactNode } from "react";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";

interface AppLayoutProps {
  title: string;
  children: ReactNode;
  sidebarItems: { label: string; path: string }[];
}

export default function AppLayout({
  title,
  children,
  sidebarItems,
}: AppLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation(); // ← para saber la ruta actual

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {title}
          </h1>
          <div className="flex items-center space-x-4 lg:space-x-6">
            <span className="text-sm lg:text-base text-gray-700">
              Bienvenido, {user?.name} ({user?.role})
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm lg:text-base"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-6">
        {/* Sidebar fija */}
        <aside className="hidden lg:block w-64 bg-white rounded-lg shadow p-4">
          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const isExact = location.pathname === item.path;
              const isChild = location.pathname.startsWith(item.path + "/");
              const isActive = isExact || (isChild && item.path !== "/admin" && item.path !== "/warehouse");

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block px-4 py-2 rounded transition text-sm font-medium ${
                    isActive
                      ? "bg-blue-600 text-white font-semibold"
                      : "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Contenido principal */}
        <main className="flex-1 bg-white rounded-lg shadow p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
