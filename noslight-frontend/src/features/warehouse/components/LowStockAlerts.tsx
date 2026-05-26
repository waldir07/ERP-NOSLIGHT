// src/features/warehouse/components/LowStockAlerts.tsx
import { useLowStockRaw, useLowStockFinished } from '../hooks/useWarehouse';


export default function LowStockAlerts() {
  //const rawAlerts = useLowStockRaw(50); // threshold ajustable
  //const finishedAlerts = useLowStockFinished(20);

  //const alerts = [...(rawAlerts.data ?? []), ...(finishedAlerts.data ?? [])];

  const { data: rawData } = useLowStockRaw(50);
  const { data: finishedData } = useLowStockFinished(20);

  const rawAlerts = rawData?.low_stocks ?? [];  // ajustado a tu structure
  const finishedAlerts = finishedData?.low_stocks ?? [];

  const alerts = [...rawAlerts, ...finishedAlerts];

  if (rawAlerts.isLoading || finishedAlerts.isLoading) {
    return <div className="text-center py-12">Cargando alertas...</div>;
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-16 bg-green-50 rounded-xl">
        <p className="text-xl font-medium text-green-700">¡Todo en orden!</p>
        <p className="mt-2 text-gray-600">No hay materiales con stock bajo en este momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-red-700">Alertas de Bajo Stock</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {alerts.map((item, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow border border-red-200 hover:shadow-lg transition">
            <h3 className="text-lg font-semibold text-red-800">{item.name || 'Producto'}</h3>
            <p className="mt-2 text-2xl font-bold text-red-600">{item.quantity} {item.unit || 'unidades'}</p>
            <p className="mt-1 text-sm text-gray-600">
              {item.is_raw ? 'Materia Prima' : 'Producto Terminado'} • Umbral: {item.min_threshold || '?'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}