// src/features/admin/components/GastosImportacionModal.tsx
import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import axios from "@/lib/axios";

interface Props {
  importacionId: number;
  onClose: () => void;
}

export default function GastosImportacionModal({
  importacionId,
  onClose,
}: Props) {
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);

  const [gastos, setGastos] = useState<any[]>([]);
  const [nuevoGasto, setNuevoGasto] = useState({
    descripcion: "",
    monto: 0,
    moneda: "USD" as "USD" | "PEN",
  });

  const agregarGasto = () => {
    if (!nuevoGasto.descripcion || nuevoGasto.monto <= 0) {
      toastError("Descripción y monto son obligatorios");
      return;
    }

    setGastos([...gastos, { ...nuevoGasto }]);
    setNuevoGasto({ descripcion: "", monto: 0, moneda: "USD" });
  };

  const eliminarGasto = (index: number) => {
    setGastos(gastos.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    // Limpiar todo antes de cerrar
    setGastos([]);
    setNuevoGasto({ descripcion: "", monto: 0, moneda: "USD" });
    onClose();
  };

  const guardarGastos = async () => {
    if (gastos.length === 0) {
      toastError("Agrega al menos un gasto");
      return;
    }

    setLoading(true);

    try {
      await axios.post(`/api/importaciones/${importacionId}/gastos`, {
        gastos,
      });

      success("Gastos guardados y importación completada");
      onClose();
    } catch (err: any) {
      toastError(err.response?.data?.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold">Agregar Gastos a Importación</h2>
          <p className="text-gray-600">Importación #{importacionId}</p>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-12 gap-4 mb-6 border p-5 rounded-xl bg-gray-50">
            <div className="col-span-6">
              <label className="block text-sm mb-1">
                Descripción del gasto
              </label>
              <input
                type="text"
                value={nuevoGasto.descripcion}
                onChange={(e) =>
                  setNuevoGasto({ ...nuevoGasto, descripcion: e.target.value })
                }
                className="w-full border rounded-xl px-4 py-3"
                placeholder="Ej: Flete marítimo, Seguro, etc."
              />
            </div>
            <div className="col-span-3">
              <label className="block text-sm mb-1">Monto</label>
              <input
                type="number"
                step="0.01"
                value={nuevoGasto.monto}
                onChange={(e) =>
                  setNuevoGasto({
                    ...nuevoGasto,
                    monto: Number(e.target.value),
                  })
                }
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>
            <div className="col-span-3">
              <label className="block text-sm mb-1">Moneda</label>
              <select
                value={nuevoGasto.moneda}
                onChange={(e) =>
                  setNuevoGasto({
                    ...nuevoGasto,
                    moneda: e.target.value as "USD" | "PEN",
                  })
                }
                className="w-full border rounded-xl px-4 py-3"
              >
                <option value="USD">USD</option>
                <option value="PEN">PEN</option>
              </select>
            </div>
            <div className="col-span-12 flex justify-end">
              <button
                onClick={agregarGasto}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700"
              >
                Agregar Gasto
              </button>
            </div>
          </div>

          {gastos.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">
                Gastos agregados ({gastos.length})
              </h3>
              <div className="space-y-3">
                {gastos.map((g, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-white border rounded-xl p-4"
                  >
                    <div>
                      <strong>{g.descripcion}</strong>
                      <div className="text-sm text-gray-600">
                        {g.monto} {g.moneda}
                      </div>
                    </div>
                    <button
                      onClick={() => eliminarGasto(i)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t flex justify-end gap-4">
          <button
            onClick={handleClose}
            className="px-8 py-3 text-gray-600 hover:bg-gray-100 rounded-xl"
          >
            Cancelar
          </button>
          <button
            onClick={guardarGastos}
            disabled={loading || gastos.length === 0}
            className="px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar Gastos"}
          </button>
        </div>
      </div>
    </div>
  );
}
