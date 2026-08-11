// src/features/store/components/StoreDashboard.tsx
import { ShoppingBag, ArrowDownCircle, Package } from "lucide-react";
import { StockSlider } from "./StockSlider"; 
import StoreDashboardCharts from './StoreDashboardCharts.tsx';


export default function StoreDashboard() {
  const stats = [
    { label: "Ventas de Hoy", value: "S/ 0.00", icon: <ShoppingBag />, color: "bg-blue-500" },
    { label: "Ingresos Pendientes", value: "Ver lista", icon: <ArrowDownCircle />, color: "bg-amber-500" },
    { label: "Stock Total", value: "Consultar", icon: <Package />, color: "bg-green-500" },
  ];

  return (
     <div className="p-0">
      

      {/* 📊 SECCIÓN DE GRÁFICAS ANALÍTICAS (Inyectada de forma segura) */}
      <StoreDashboardCharts />
      
    </div>
  );
}
