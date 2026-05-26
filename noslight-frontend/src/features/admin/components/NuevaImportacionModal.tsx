// src/features/admin/components/NuevaImportacionModal.tsx
import { useState, useEffect } from "react";
import { useToast } from "@/components/ToastProvider";
import axios from "@/lib/axios";
import type { Product } from "../hooks/useAdminProducts";

interface Props {
  onClose: () => void;
  onImportacionCreada?: (id: number) => void;
}

export default function NuevaImportacionModal({
  onClose,
  onImportacionCreada,
}: Props) {
  const { success, error: toastError } = useToast();

  const [form, setForm] = useState({
    invoice_code: "",
    bl_awb: "",
    fecha_aviso: "",
    fecha_llegada_almacen: "",
    valor_dolar: 3.75,
    notes: "",
  });

  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [detalles, setDetalles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [nuevoDetalle, setNuevoDetalle] = useState({
    product_id: 0,
    precio_unitario_proveedor: 0,
    cantidad: 0,
    costo_declarado: 0,
  });

  // Cargar productos RAW
  useEffect(() => {
    axios
      .get("/api/products")
      .then((res) => {
        const all = res.data.data || res.data || [];
        setRawProducts(all.filter((p: Product) => p.is_raw));
      })
      .catch(() => toastError("Error al cargar productos RAW"));
  }, []);

  const agregarProducto = () => {
    if (
      !nuevoDetalle.product_id ||
      nuevoDetalle.precio_unitario_proveedor <= 0 ||
      nuevoDetalle.cantidad <= 0
    ) {
      toastError("Producto, precio unitario y cantidad son obligatorios");
      return;
    }

    const product = rawProducts.find((p) => p.id === nuevoDetalle.product_id);
    if (!product) return;

    setDetalles([
      ...detalles,
      {
        product_id: nuevoDetalle.product_id,
        product_name: product.name,
        base_code: product.base_code,
        precio_unitario_proveedor: nuevoDetalle.precio_unitario_proveedor,
        cantidad: nuevoDetalle.cantidad,
        costo_declarado: nuevoDetalle.costo_declarado || null,
      },
    ]);

    setNuevoDetalle({
      product_id: 0,
      precio_unitario_proveedor: 0,
      cantidad: 0,
      costo_declarado: 0,
    });
  };

  const eliminarDetalle = (index: number) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const fobTotal = detalles.reduce(
    (sum, d) => sum + d.precio_unitario_proveedor * d.cantidad,
    0,
  );

  const handleSubmit = async () => {
    if (
      !form.invoice_code ||
      !form.fecha_llegada_almacen ||
      detalles.length === 0
    ) {
      toastError(
        "Invoice, Fecha de Llegada y al menos un producto son obligatorios",
      );
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post("/api/importaciones", {
        ...form,
        proveedor_id: null,
        empresa_importadora_id: null,
        fob_total: fobTotal,
        detalles: detalles,
      });

      const newId = response.data.importacion?.id || response.data.id;

      success("Importación guardada correctamente");

      onClose();

      // ← Abre automáticamente el modal de gastos
      if (onImportacionCreada && newId) {
        onImportacionCreada(newId);
      }
    } catch (err: any) {
      toastError(
        err.response?.data?.message || "Error al guardar la importación",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold">Nueva Importación</h2>
          <p className="text-gray-600">
            Registro de llegada de productos RAW (M-)
          </p>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-8">
          {/* Datos Generales */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Invoice Code *
              </label>
              <input
                type="text"
                value={form.invoice_code}
                onChange={(e) =>
                  setForm({
                    ...form,
                    invoice_code: e.target.value.toUpperCase(),
                  })
                }
                className="w-full border rounded-xl px-4 py-3"
                placeholder="INV-20260423-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Fecha Llegada Almacén *
              </label>
              <input
                type="date"
                value={form.fecha_llegada_almacen}
                onChange={(e) =>
                  setForm({ ...form, fecha_llegada_almacen: e.target.value })
                }
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Valor Dólar (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.valor_dolar}
                onChange={(e) =>
                  setForm({ ...form, valor_dolar: Number(e.target.value) })
                }
                className="w-full border rounded-xl px-4 py-3"
              />
            </div>
          </div>

          {/* Agregar Producto */}
          <div>
            <h3 className="font-semibold mb-4">Agregar Producto RAW</h3>
            <div className="grid grid-cols-12 gap-3 items-end border p-5 rounded-xl bg-gray-50">
              <div className="col-span-4">
                <label className="block text-sm mb-1">Producto RAW</label>
                <select
                  value={nuevoDetalle.product_id}
                  onChange={(e) =>
                    setNuevoDetalle({
                      ...nuevoDetalle,
                      product_id: Number(e.target.value),
                    })
                  }
                  className="w-full border rounded-xl px-4 py-3"
                >
                  <option value="0">Selecciona producto...</option>
                  {rawProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.is_raw ? 'M-' : ''}{p.base_code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-3">
                <label className="block text-sm mb-1">Precio Unit. (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={nuevoDetalle.precio_unitario_proveedor}
                  onChange={(e) =>
                    setNuevoDetalle({
                      ...nuevoDetalle,
                      precio_unitario_proveedor: Number(e.target.value),
                    })
                  }
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm mb-1">Cantidad</label>
                <input
                  type="number"
                  value={nuevoDetalle.cantidad}
                  onChange={(e) =>
                    setNuevoDetalle({
                      ...nuevoDetalle,
                      cantidad: Number(e.target.value),
                    })
                  }
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <div className="col-span-3">
                <label className="block text-sm mb-1">Costo Declarado</label>
                <input
                  type="number"
                  step="0.01"
                  value={nuevoDetalle.costo_declarado}
                  onChange={(e) =>
                    setNuevoDetalle({
                      ...nuevoDetalle,
                      costo_declarado: Number(e.target.value),
                    })
                  }
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <div className="col-span-12 flex justify-end pt-2">
                <button
                  onClick={agregarProducto}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl"
                >
                  Agregar Producto
                </button>
              </div>
            </div>
          </div>

          {/* Productos agregados */}
          {detalles.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">
                Productos en esta importación ({detalles.length})
              </h3>
              <div className="space-y-3">
                {detalles.map((d, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-white border rounded-xl p-4"
                  >
                    <div>
                      <strong>{d.product_name}</strong> — {d.base_code}
                      <div className="text-sm text-gray-600">
                        {d.cantidad} und × ${d.precio_unitario_proveedor} = $
                        {(d.precio_unitario_proveedor * d.cantidad).toFixed(2)}
                        {d.costo_declarado > 0 && (
                          <span className="ml-4">
                            | Declarado: ${d.costo_declarado}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => eliminarDetalle(i)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-50 p-5 rounded-xl">
            <h3 className="font-semibold mb-3">Resumen</h3>
            <p className="text-xl">
              FOB Total: <strong>${fobTotal.toFixed(2)} USD</strong>
            </p>
          </div>
        </div>

        <div className="p-6 border-t flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-8 py-3 text-gray-600 hover:bg-gray-100 rounded-xl"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || detalles.length === 0}
            className="px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar Importación"}
          </button>
        </div>
      </div>
    </div>
  );
}
