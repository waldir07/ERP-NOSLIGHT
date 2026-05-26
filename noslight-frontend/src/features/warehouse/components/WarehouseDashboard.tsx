// src/features/warehouse/components/WarehouseDashboard.tsx
import { Link } from "react-router-dom";
import {
  useRawStock,
  useFinishedStock,
  useLowStockRaw,
} from "../hooks/useWarehouse";

export default function WarehouseDashboard() {
  const rawQuery = useRawStock();
  const finishedQuery = useFinishedStock();
  const lowStockQuery = useLowStockRaw(50);

  const rawCount = rawQuery.data?.length ?? 0;
  const finishedCount = finishedQuery.data?.length ?? 0;
  const lowStockCount = lowStockQuery.data?.low_stocks?.length ?? 0;

  const isLoading = rawQuery.isLoading || finishedQuery.isLoading || lowStockQuery.isLoading;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-600">
          Cargando datos del almacén...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="stock/raw"
          className="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition border border-gray-200 flex flex-col justify-between"
        >
          <div>
            <h3 className="text-xl font-semibold mb-2 text-blue-700">Stock Materia Prima</h3>
            <p className="text-5xl font-bold text-gray-800">{rawCount}</p>
            <p className="text-sm text-gray-600 mt-1">materiales en almacén</p>
          </div>
          <p className="mt-6 text-sm text-gray-500">Ver y gestionar materias primas</p>
        </Link>

        <Link
          to="stock/finished"
          className="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition border border-gray-200 flex flex-col justify-between"
        >
          <div>
            <h3 className="text-xl font-semibold mb-2 text-green-700">Stock Producto Terminado</h3>
            <p className="text-5xl font-bold text-gray-800">{finishedCount}</p>
            <p className="text-sm text-gray-600 mt-1">productos listos</p>
          </div>
          <p className="mt-6 text-sm text-gray-500">Ver stock para tienda</p>
        </Link>

        <Link
          to="alerts"
          className="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition border border-gray-200 flex flex-col justify-between relative"
        >
          <div>
            <h3 className="text-xl font-semibold mb-2 text-red-700">Alertas Bajo Stock</h3>
            <p className="text-5xl font-bold text-gray-800">{lowStockCount}</p>
            <p className="text-sm text-gray-600 mt-1">materiales críticos</p>
          </div>
          {lowStockCount > 0 && (
            <span className="absolute top-6 right-6 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              ¡Atención!
            </span>
          )}
          <p className="mt-6 text-sm text-gray-500">Ver materiales con stock bajo</p>
        </Link>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-2xl border border-blue-200">
        <h3 className="text-2xl font-semibold mb-4 text-indigo-800">Acciones Rápidas</h3>
        <div className="flex gap-4">
          <Link
            to="transform"
            className="flex-1 bg-indigo-600 text-white text-center py-4 rounded-2xl hover:bg-indigo-700 transition font-medium"
          >
            Transformar Materia Prima
          </Link>
          <Link
            to="send-to-store"
            className="flex-1 bg-emerald-600 text-white text-center py-4 rounded-2xl hover:bg-emerald-700 transition font-medium"
          >
            Enviar a Tienda
          </Link>
        </div>
      </div>
    </div>
  );
}