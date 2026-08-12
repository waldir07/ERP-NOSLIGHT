// src/features/store/components/StoreDashboardCharts.tsx
import { useCallback, useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts'; // 👈 Esto ya lo corrigió Claude con éxito
import axios from 'axios';
import { TrendingUp, Clock, ShieldCheck, RefreshCw, HelpCircle, FileClock } from 'lucide-react';

type CoverageStatus = 'agotado' | 'critico' | 'alerta' | 'vigilar';


interface LowStockItem {
  name: string;
  sku: string;
  current: number;
  limit: number;
  pct: number;
  days: number | null; // null si no tiene rotación
  dailyVelocity: number;
  hasVelocity: boolean;
  status: CoverageStatus;
}

interface DashboardData {
  salesByHour: {
    categories: string[];
    todayData: number[];
    historyData: number[];
    pendingData: number[];
  };
  motivation: {
    currentWeek: number;
    avgWeek: number;
    percent: number;
  };
  topProducts: {
    categories: string[];
    data: number[];
  };
  vipCustomers: {
    labels: string[];
    data: number[];
  };
  creditRecords: {
    labels: string[];
    data: number[];
  };
  pendingVales?: {
    count: number;
    amount: number;
  };
  lowStock: LowStockItem[];
}

export default function StoreDashboardCharts() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("noslight_token");
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/charts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      });
      setData(response.data);
      setError(null);
    } catch (err: any) {
      // Manejo específico de autenticación
      if (err?.response?.status === 401) {
        console.warn('API returned 401 — token inválido o expirado');
        setError('Sesión expirada. Por favor inicia sesión.');
      } else {
        console.error("Error al conectar con la API de Laravel:", err);
        setError("No se pudieron cargar los datos del servidor.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full animate-pulse p-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="bg-gray-100 h-[340px] rounded-[40px] border border-gray-200" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full text-center p-20 bg-red-50 rounded-[40px] border border-red-200 text-red-700 font-bold">
        ⚠️ {error || "Error de sincronización con el servidor."}
      </div>
    );
  }

  const lineChartOptions: ApexOptions = {
    chart: { id: 'sales-by-hour', toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
    xaxis: { categories: data.salesByHour.categories },
    stroke: { curve: 'smooth', width: [3, 3, 2], dashArray: [0, 4, 6] },
    colors: ['#3b82f6', '#9ca3af', '#f59e0b'],
    tooltip: { shared: true, intersect: false, y: { formatter: (val) => `S/ ${val.toFixed(2)}` } },
    title: { text: 'Ritmo de Ventas: Hoy vs Promedio Histórico', style: { fontSize: '16px', fontWeight: 600, color: '#1f2937' } },
    legend: { position: 'top', horizontalAlign: 'right' }
  };

  const lineChartSeries = [
    { name: 'Facturado Hoy (S/)', data: data.salesByHour.todayData },
    { name: 'Promedio Histórico Día (S/)', data: data.salesByHour.historyData },
    { name: 'Vales Pendientes (S/)', data: data.salesByHour.pendingData }
  ];

  const barChartOptions: ApexOptions = {
    chart: { id: 'top-products', toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
    plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 4 } },
    colors: ['#10b981'],
    xaxis: { categories: data.topProducts.categories },
    title: { text: 'Top 5 Productos Terminados Más Vendidos (Mes)', style: { fontSize: '16px', fontWeight: 600, color: '#1f2937' } }
  };

  const donutChartOptions: ApexOptions = {
    chart: { id: 'top-customers', fontFamily: 'Inter, sans-serif' },
    labels: data.vipCustomers.labels,
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#9ca3af'],
    legend: { position: 'bottom' },
    title: { text: 'Participación de Clientes VIP (Mes)', style: { fontSize: '16px', fontWeight: 600, color: '#1f2937' } },
    tooltip: { y: { formatter: (val) => `S/ ${val.toLocaleString()}` } }
  };

  // 🛠️ Nueva configuración visual para el Semáforo de Créditos
  const creditChartOptions: ApexOptions = {
    chart: { id: 'credit-records', toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
    plotOptions: { bar: { horizontal: true, barHeight: '45%', borderRadius: 4 } },
    colors: ['#8b5cf6'], // Color morado consistente con tu tarjeta de Récord Comercial
    xaxis: { categories: data.creditRecords.labels },
    title: { text: 'Récord Comercial: Días de Pago Promedio', style: { fontSize: '16px', fontWeight: 600, color: '#1f2937' } },
    tooltip: { y: { formatter: (val) => `${val} Días para liquidar` } }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* TARJETA DE MOTIVACIÓN */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-[40px] shadow-md border border-blue-700 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-300 animate-bounce" /> ¡Tu Ritmo de Venta Semanal!
          </h2>
          <p className="text-blue-100 text-xs mt-1 uppercase tracking-wider font-semibold">Comparativa de rendimiento de mostrador a corto plazo</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] text-blue-200 uppercase font-black tracking-widest">Llevas Vendido</p>
            <p className="text-2xl font-black">S/ {data.motivation.currentWeek.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/10 text-center">
            <p className="text-[9px] text-blue-200 uppercase font-bold tracking-widest">Vs. Histórico</p>
            <p className={`text-sm font-black ${data.motivation.percent >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {data.motivation.percent >= 0 ? '+' : ''}{data.motivation.percent}%
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={fetchDashboardData}
              title="Actualizar"
              className="p-2 bg-white/10 rounded-full border border-white/10 hover:bg-white/20">
              <RefreshCw className="w-5 h-5 text-white" />
            </button>
            <p className="text-xs text-white/90 mt-1">Vales: <strong>{data.pendingVales?.count ?? 0}</strong></p>
            <p className="text-[10px] text-white/80">S/ {(data.pendingVales?.amount ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Fila central: Línea comparativa y Barras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[40px] shadow-sm border border-gray-100">
          <Chart options={lineChartOptions} series={lineChartSeries} type="line" height={320} />
        </div>
        <div className="bg-white p-6 rounded-[40px] shadow-sm border border-gray-100">
          <Chart options={barChartOptions} series={[{ name: 'Unidades', data: data.topProducts.data }]} type="bar" height={320} />
        </div>
      </div>

      {/* Fila inferior: Clientes VIP y Panel de Predicción Temporal de Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[40px] shadow-sm border border-gray-100 flex flex-col justify-between">
          <Chart options={donutChartOptions} series={data.vipCustomers.data} type="donut" height={320} />
        </div>

        {/* 🔮 TARJETA PREDICTIVA CON TIEMPO ESTIMADO DE AGOTAMIENTO */}
        <div className="bg-white p-6 rounded-[40px] shadow-sm border border-gray-100 flex flex-col h-[395px]">
          <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
            Panel de Reposición Predictiva
          </h2>
          <p className="text-xs text-gray-400 font-medium mb-4">Análisis de agotamiento estimado según la velocidad de venta local.</p>

          <div className="flex flex-col gap-4 overflow-y-auto pr-2 flex-1 scrollbar-thin scrollbar-thumb-gray-200">
            {data.lowStock.map((prod, i) => {
              // 1. Declaramos primero si el producto está estancado o agotado
              const isAgotado = prod.current === 0;
              const isEstancado = prod.days === null || prod.days === 999;

              // 2. Ahora sí calculamos si es crítico protegiendo el null con ?? 999
              const isCritical = (prod.days ?? 999) <= 3 && !isEstancado && !isAgotado;

              // 3. El color del badge reacciona según los estados
              const badgeColor = isCritical
                ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                : isEstancado
                  ? "bg-gray-100 text-gray-600 border-gray-300"
                  : "bg-amber-50 text-amber-700 border-amber-200";

              return (
                <div key={i} className="flex flex-col gap-1.5 border-b border-gray-50 pb-3 last:border-0">
                  <div className="flex justify-between items-start text-xs font-black text-gray-700 gap-2">
                    <span className="uppercase tracking-tight truncate max-w-64" title={prod.name}>{prod.name}</span>

                    {/* Badge Predictivo Inteligente */}
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 shrink-0 ${badgeColor}`}>
                      <Clock className="w-3 h-3" />
                      Quedan {prod.days} {prod.days === 1 ? 'Día' : 'Días'}
                    </span>
                  </div>

                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isCritical ? 'bg-red-500' : 'bg-amber-500'}`}
                      style={{ width: `${prod.pct}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold">
                    <span>Stock actual: {prod.current} / {prod.limit} Unid.</span>
                    <span className={isCritical ? 'text-red-500' : 'text-amber-500'}>
                      {isCritical ? '⚠️ Abastecimiento Urgente' : '⚡ Programar pedido'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 🚀 NUEVA FILA COMPROMETIDA CON EL EXPEDIENTE DE CRÉDITO */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-[40px] shadow-sm border border-gray-100">
          <Chart options={creditChartOptions} series={[{ name: 'Días Promedio', data: data.creditRecords.data }]} type="bar" height={260} />
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-purple-500" /> Los datos coinciden directamente con el algoritmo de evaluación del expediente comercial.
          </p>
        </div>
      </div>
    </div>
  );
}
