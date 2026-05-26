import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  PackageSearch,
  Download,
  ShoppingCart,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  History,
  Receipt
} from "lucide-react";
import { useState } from "react";

export default function StoreSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    // Limpiamos los datos correctos de la sesión
    localStorage.removeItem("noslight_token");
    localStorage.removeItem("noslight_user");

    navigate("/login");
    window.location.reload();
  };

  const menuItems = [
    { label: "Panel Central", path: "/store", icon: <LayoutDashboard size={20} /> },
    { label: "Recibir Carga", path: "/store/receive", icon: <Download size={20} /> },
    { label: "Mi Stock", path: "/store/stock", icon: <PackageSearch size={20} /> },
    { label: "Nueva Venta", path: "/store/pos", icon: <ShoppingCart size={20} /> },
    { label: "Créditos", path: "/store/credits", icon: <CreditCard size={20} /> },
    { label: "Historial Ventas", path: "/store/historial", icon: <History size={20} /> }, // <-- AGREGA ESTA LÍNEA EXACTAMENTE AQUÍ
    { label: "Gastos", path: "/store/gastos", icon: <Receipt size={20} /> }, // puedes cambiar el emoji o usar icono de lucide-react
    { label: "Cierre de Caja", path: "/store/cash-closures", icon: <Receipt size={20} /> }, // <-- AGREGA ESTA LÍNEA EXACTAMENTE AQUÍ
  ];

  

  return (
    /* CONTENEDOR PADRE: Solo maneja el tamaño y sostiene el botón libremente */
    <div
      className={`relative h-screen transition-[width] duration-300 ease-in-out flex-shrink-0 ${isCollapsed ? "w-24" : "w-72"
        }`}
    >
      {/* BOTÓN FLECHA: Centrado verticalmente y sin ser cortado */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white border border-gray-100 text-gray-400 hover:text-blue-600 rounded-full p-1 shadow-md z-50 transition-transform hover:scale-110"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* CONTENEDOR HIJO: Maneja el fondo, los bordes y oculta el texto sobrante (overflow-hidden) */}
      <div className="h-full w-full overflow-hidden bg-white border-r border-gray-100 flex flex-col p-4">

        {/* LOGO */}
        <div className={`mb-10 px-4 flex flex-col transition-all duration-300 ${isCollapsed ? "items-center" : "items-start"}`}>
          <h1 className={`font-black tracking-tighter text-gray-900 ${isCollapsed ? "text-xl" : "text-2xl"}`}>
            {isCollapsed ? (
              <span className="text-blue-600">N</span>
            ) : (
              <span className="whitespace-nowrap">NOSLIGHT <span className="text-blue-600">STORE</span></span>
            )}
          </h1>
          {!isCollapsed && (
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
              Punto de Venta
            </p>
          )}
        </div>

        {/* NAVEGACIÓN */}
        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/store"}
              className={({ isActive }) => `
                flex items-center gap-4 py-4 rounded-[22px] font-bold text-sm transition-colors w-full
                ${isCollapsed ? "justify-center px-0" : "px-6"}
                ${isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"}
              `}
            >
              <span className="shrink-0">{item.icon}</span>
              {!isCollapsed && (
                <span className="whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* CERRAR SESIÓN */}
        <div className="mt-auto border-t border-gray-50 pt-6">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-4 py-4 w-full text-gray-400 font-bold text-sm hover:text-red-500 transition-colors ${isCollapsed ? "justify-center px-0" : "px-6"
              }`}
          >
            <LogOut size={20} className="shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">Cerrar Sesión</span>}
          </button>
        </div>

      </div>
    </div>
  );
}