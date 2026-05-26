// src/features/store/components/StoreDashboard.tsx
import { ShoppingBag, ArrowDownCircle, Package } from "lucide-react";

export default function StoreDashboard() {
  const stats = [
    { label: "Ventas de Hoy", value: "S/ 0.00", icon: <ShoppingBag />, color: "bg-blue-500" },
    { label: "Ingresos Pendientes", value: "Ver lista", icon: <ArrowDownCircle />, color: "bg-amber-500" },
    { label: "Stock Total", value: "Consultar", icon: <Package />, color: "bg-green-500" },
  ];

  return (
    <div className="p-10">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-gray-900 italic uppercase tracking-tighter">
          Panel de Tienda
        </h1>
        <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[2px]">Resumen de operaciones</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex items-center gap-6 hover:shadow-lg transition-all">
            <div className={`${stat.color} p-4 rounded-2xl text-white shadow-lg`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}