// src/features/admin/components/ImportacionesPage.tsx
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import NuevaImportacionModal from "./NuevaImportacionModal";
import GastosImportacionModal from "./GastosImportacionModal";
import ImportacionDetalleModal from "./ImportacionDetalleModal";   // ← Nuevo
import { useToast } from "@/components/ToastProvider";

export default function ImportacionesPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [showNuevaModal, setShowNuevaModal] = useState(false);
  const [showGastosModal, setShowGastosModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);   // ← Nuevo
  const [selectedImportacionId, setSelectedImportacionId] = useState<
    number | null
  >(null);

  // Estados para filtros de búsqueda
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: importaciones = [], isLoading } = useQuery({
    queryKey: ["importaciones"],
    queryFn: async () => {
      const res = await axios.get("/api/importaciones");
      return res.data.data || res.data;
    },
  });

  // Filtrar importaciones según criterios de búsqueda
  const filteredImportaciones = importaciones.filter((imp: any) => {
    const invoiceMatch = imp.invoice_code
      .toLowerCase()
      .includes(invoiceSearch.toLowerCase());

    let dateMatch = true;
    if (dateFrom || dateTo) {
      const impDate = new Date(imp.fecha_llegada_almacen);
      if (dateFrom) {
        const from = new Date(dateFrom);
        dateMatch = dateMatch && impDate >= from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999); // Incluir todo el día
        dateMatch = dateMatch && impDate <= to;
      }
    }

    return invoiceMatch && dateMatch;
  });

  const handleNuevaImportacionCreada = (newId?: number) => {
    setShowNuevaModal(false);
    if (newId) {
      setSelectedImportacionId(newId);
      setShowGastosModal(true);
    } else {
      queryClient.invalidateQueries({ queryKey: ["importaciones"] });
    }
  };

  const handleAbrirGastos = (id: number) => {
    setSelectedImportacionId(id);
    setShowGastosModal(true);
  };

  const handleVerDetalle = (id: number) => {
    setSelectedImportacionId(id);
    setShowDetalleModal(true);
  };

  const handleCloseGastos = () => {
    setShowGastosModal(false);
    setSelectedImportacionId(null);
    queryClient.invalidateQueries({ queryKey: ["importaciones"] });
  };

  const handleCloseDetalle = () => {
    setShowDetalleModal(false);
    setSelectedImportacionId(null);
  };

  const handleEliminarImportacion = async (id: number) => {
    if (
      !confirm(
        "¿Estás seguro de eliminar esta importación? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }

    try {
      await axios.delete(`/api/importaciones/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["importaciones"] });
      success("Importación eliminada correctamente");
    } catch (err: any) {
      toastError(
        err.response?.data?.message || "Error al eliminar la importación",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Importaciones</h1>
        <button
          onClick={() => setShowNuevaModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2"
        >
          + Nueva Importación
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Código de Invoice
            </label>
            <input
              type="text"
              placeholder="Buscar por código de invoice..."
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Desde
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hasta
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setInvoiceSearch("");
                setDateFrom("");
                setDateTo("");
              }}
              className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left">INVOICE</th>
              <th className="px-6 py-4 text-left">FECHA LLEGADA</th>
              <th className="px-6 py-4 text-right">FOB TOTAL</th>
              <th className="px-6 py-4 text-right">GASTOS</th>
              <th className="px-6 py-4 text-right">FACTOR</th>
              <th className="px-6 py-4 text-center">ESTADO</th>
              <th className="px-6 py-4 text-center">ACCIONES</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredImportaciones.map((imp: any) => (
              <tr key={imp.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{imp.invoice_code}</td>
                <td className="px-6 py-4 text-gray-600">
                  {new Date(imp.fecha_llegada_almacen).toLocaleDateString(
                    "es-ES",
                  )}
                </td>
                <td className="px-6 py-4 text-right font-medium">
                  ${Number(imp.fob_total || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right">
                  ${Number(imp.gastos_total || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right font-medium">
                  {Number(imp.factor || 1).toFixed(4)}
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className={`inline-block px-4 py-1 rounded-full text-sm font-medium
                    ${
                      imp.estado === "completada"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {imp.estado === "completada" ? "Completada" : "En Proceso"}
                  </span>
                </td>
                <td className="px-6 py-4 text-center flex gap-4 justify-center">
                  <button
                    onClick={() => handleAbrirGastos(imp.id)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Agregar Gastos
                  </button>

                  {imp.estado !== "completada" && (
                    <button
                      onClick={() => handleEliminarImportacion(imp.id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Eliminar
                    </button>
                  )}

                  <button
                    onClick={() => handleVerDetalle(imp.id)}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Ver Detalle
                  </button>
                </td>
              </tr>
            ))}

            {filteredImportaciones.length === 0 && !isLoading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  {importaciones.length === 0
                    ? "No hay importaciones registradas"
                    : "No se encontraron importaciones con los filtros seleccionados"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Nueva Importación */}
      {showNuevaModal && (
        <NuevaImportacionModal
          onClose={() => setShowNuevaModal(false)}
          onImportacionCreada={(id) => {
            setSelectedImportacionId(id);
            setShowGastosModal(true);
          }}
        />
      )}

      {/* Modal Gastos */}
      {showGastosModal && selectedImportacionId && (
        <GastosImportacionModal
          importacionId={selectedImportacionId}
          onClose={handleCloseGastos}
        />
      )}

      {showDetalleModal && selectedImportacionId && (
        <ImportacionDetalleModal
          importacionId={selectedImportacionId}
          onClose={handleCloseDetalle}
        />
      )}

    </div>
  );
}
