// src/features/admin/components/AdminRawTransformationsModal.tsx
import { useState, useEffect } from "react";
import { useToast } from "@/components/ToastProvider";
import axios from "@/lib/axios";
import type { Product } from "../hooks/useAdminProducts";
import { useQueryClient } from "@tanstack/react-query"; // <-- ESTA LÍNEA ES NUEVA

interface Props {
  rawProduct: Product;
  onClose: () => void;
}

export default function AdminRawTransformationsModal({
  rawProduct,
  onClose,
}: Props) {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient(); // <-- AGREGA ESTA LÍNEA AQUÍ

  const [transformations, setTransformations] = useState<any[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Formulario simplificado
  const [selectedFinishedId, setSelectedFinishedId] = useState<number | null>(
    null,
  );
  const [isDirectSale, setIsDirectSale] = useState(
    rawProduct.is_direct_sale || false,
  );
  const [notes, setNotes] = useState<string>("");

  // Cargar datos
  const loadData = async () => {
    try {
      setLoading(true);

      // Transformaciones existentes
      const transRes = await axios.get(
        `/api/transformations/possible?raw_product_id=${rawProduct.id}&raw_amperage=${rawProduct.amperage || 0}`,
      );
      setTransformations(transRes.data.possible_finished || []);

      // Productos terminados disponibles
      const finishedRes = await axios.get("/api/products");
      const allProducts = finishedRes.data.data || finishedRes.data || [];
      const finishedOnly = allProducts.filter((p: Product) => !p.is_raw);
      setFinishedProducts(finishedOnly);
    } catch (err: any) {
      toastError("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [rawProduct.id]);

  // Función para manejar el checkbox
  // Función para manejar el checkbox
  const handleToggleDirectSale = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const isChecked = e.target.checked;
    setIsDirectSale(isChecked); // Cambia el color del check instantáneamente

    try {
      // Armamos un paquete limpio igual al formulario de edición principal
      const payload = {
        name: rawProduct.name,
        base_code: rawProduct.base_code,
        model: rawProduct.model || null,
        package_size: rawProduct.package_size,
        is_raw: rawProduct.is_raw,
        cost_price: rawProduct.cost_price,
        supplier: rawProduct.supplier || null,
        notes: rawProduct.notes || null,
        is_direct_sale: isChecked, // <--- NUESTRO NUEVO DATO
      };

      await axios.put(`/api/products/${rawProduct.id}`, payload);

      success("Permiso de envío directo actualizado");
      queryClient.invalidateQueries({ queryKey: ["admin-products"] }); // Recarga la tabla de atrás
    } catch (err: any) {
      setIsDirectSale(!isChecked); // Si falla, regresa el check a como estaba

      // Imprimimos el error real en consola y en la alerta roja
      console.error("Detalle del error al actualizar:", err.response || err);
      toastError(
        err.response?.data?.message || "Error del servidor al actualizar",
      );
    }
  };

  const handleAddTransformation = async () => {
    if (!selectedFinishedId) {
      toastError("Debes seleccionar un producto terminado");
      return;
    }

    try {
     // Buscamos el producto terminado seleccionado para saber su amperaje real
      const selectedFinishedProduct = finishedProducts.find(p => p.id === selectedFinishedId);

      await axios.post("/api/product-transformations", {
        raw_product_id: rawProduct.id,
        raw_amperage: rawProduct.amperage || 0, // Usamos el amperaje real de la base de datos
        finished_product_id: selectedFinishedId,
        finished_amperage: selectedFinishedProduct?.amperage || 0, // Usamos el amperaje real del terminado
        conversion_rate: 1.0, 
        extra_cost: 0,
        notes: notes.trim(),
      });

      success("Transformación agregada correctamente");
      setShowAddForm(false);
      loadData();

      setSelectedFinishedId(null);
      setNotes("");
    } catch (err: any) {
      toastError(
        err.response?.data?.message || "Error al guardar la transformación",
      );
    }
  };

  const handleDelete = async (id: number) => {
    console.log("Intentando eliminar la transformación con ID:", id);

    if (!id) {
      toastError("Falla en el código: No hay un ID válido para eliminar.");
      return;
    }

    if (!confirm("¿Eliminar esta transformación?")) return;

    try {
      await axios.delete(`/api/product-transformations/${id}`);
      success("Transformación eliminada");
      loadData();
    } catch (err: any) {
      console.error("Detalle del error del servidor:", err.response || err);
      toastError(
        err.response?.data?.message || "Error del servidor al eliminar",
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">
                Configurar Transformaciones
              </h2>
              <p className="text-gray-600 mt-1">
                Raw:{" "}
                <strong className="text-purple-700">
                  M-{rawProduct.base_code}
                </strong>{" "}
                — {rawProduct.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-3xl text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          {/* ACÁ EMPIEZA LO NUEVO DEL CHECKBOX */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <input
              type="checkbox"
              id="directSaleCheck"
              checked={isDirectSale}
              onChange={handleToggleDirectSale}
              className="h-5 w-5 text-blue-600 rounded cursor-pointer"
            />
            <label
              htmlFor="directSaleCheck"
              className="text-sm font-medium text-blue-900 cursor-pointer"
            >
              Este producto se puede enviar a tienda directamente (Sin
              transformar)
            </label>
          </div>
          {/* ACÁ TERMINA LO NUEVO */}
        </div>

        <div className="flex-1 overflow-auto p-6">
          <h3 className="font-semibold mb-4">Transformaciones configuradas</h3>

          {loading ? (
            <p className="text-center py-8 text-gray-500">Cargando...</p>
          ) : transformations.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-xl text-gray-500">
              Aún no hay transformaciones configuradas para este Raw.
            </div>
          ) : (
            <div className="space-y-3">
              {transformations.map((t: any, index: number) => {
                // 👇 NUEVO ESPÍA MÁS PRECISO 👇
                console.log(
                  "Nombres de los campos de Laravel:",
                  Object.keys(t),
                );
                console.log("Datos completos:", t);
                return (
                  <div
                    key={t.id || index}
                    className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border"
                  >
                    <div className="font-medium text-gray-700">
                      → {t.finished_product_name}
                    </div>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-bold bg-red-50 px-3 py-1 rounded"
                    >
                      Eliminar
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setShowAddForm(true)}
            className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition"
          >
            + Agregar nueva transformación
          </button>
        </div>

        {/* Formulario simplificado */}
        {showAddForm && (
          <div className="border-t p-6 bg-gray-50">
            <h4 className="font-semibold mb-4">Nueva Transformación</h4>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Producto Terminado
                </label>
                <select
                  value={selectedFinishedId || ""}
                  onChange={(e) =>
                    setSelectedFinishedId(Number(e.target.value))
                  }
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecciona un producto terminado...</option>
                  {finishedProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.base_code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3"
                  placeholder="Ej: Solo para uso monofásico IC, transformar de 63A a 50A"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-3 bg-gray-300 hover:bg-gray-400 rounded-xl font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddTransformation}
                disabled={!selectedFinishedId}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Guardar Transformación
              </button>
            </div>
          </div>
        )}

        <div className="p-6 border-t">
          <button
            onClick={onClose}
            className="w-full py-3 text-gray-600 hover:bg-gray-100 rounded-xl font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
