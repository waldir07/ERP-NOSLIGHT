// src/features/warehouse/components/TransformForm.tsx
import { useState, useEffect } from "react";
import { useRawStock } from "../hooks/useWarehouse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { performTransform } from "../api/warehouseApi";
import { useToast } from "@/components/ToastProvider";
import axios from "@/lib/axios";
import { StockItem } from "../types";

export default function TransformForm() {
  const { data: rawProductsData = [], isLoading: loadingRaw } = useRawStock();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  // Estados de la interfaz
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRaw, setSelectedRaw] = useState<StockItem | null>(null);

  // Estados del formulario (Detalle)
  const [possibleFinished, setPossibleFinished] = useState<any[]>([]);
  const [selectedFinished, setSelectedFinished] = useState<any | null>(null);
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Filtrar la lista de la izquierda por búsqueda
  // Ponemos a nuestro espía aquí para ver qué llega desde Laravel
  console.log("Stock RAW recibido del backend:", rawProductsData);

  // Filtrar la lista de la izquierda por búsqueda
  const filteredRawStock = rawProductsData.filter((item: StockItem) => {
    // Para descartar que el filtro sea el culpable, vamos a imprimir cada item
    console.log("Evaluando item:", item);

   

    //2. Si no hay término de búsqueda, mostrar todo
    if (!searchTerm) return true; // Si no hay término de búsqueda, mostrar todo

    //3. Filtrar por texto
    const term = searchTerm.toLowerCase();
    const name = item.product_variant?.product?.name?.toLowerCase() || "";
    const sku = item.product_variant?.sku?.toLowerCase() || "";
    const baseCode =
      item.product_variant?.product?.base_code?.toLowerCase() || "";

    return name.includes(term) || sku.includes(term) || baseCode.includes(term);
  });

  // Efecto: Cargar los productos terminados cuando se selecciona un Raw
  useEffect(() => {
    if (!selectedRaw) {
      setPossibleFinished([]);
      setSelectedFinished(null);
      setQuantity("");
      return;
    }

    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const productId = selectedRaw.product_variant?.product_id;
        // Si no hay amperaje, mandamos 60 por defecto para que pase la validación del backend
        const rawAmperage = selectedRaw.product_variant?.amperage
          ? parseInt(selectedRaw.product_variant.amperage)
          : 60;

        const res = await axios.get(
          `/api/transformations/possible?raw_product_id=${productId}&raw_amperage=${rawAmperage}`,
        );
        setPossibleFinished(res.data.possible_finished || []);
      } catch (err: any) {
        toastError("Error al cargar las opciones de transformación.");
        setPossibleFinished([]);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
    setSelectedFinished(null); // Resetear selección
    setQuantity(""); // Resetear cantidad
  }, [selectedRaw]);

  // Ejecutar transformación
  const mutation = useMutation({
    mutationFn: performTransform,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rawStock"] });
      queryClient.invalidateQueries({ queryKey: ["finishedStock"] });

      success("¡Transformación realizada con éxito!");

      // Limpiar formulario pero mantener el producto seleccionado por si quiere hacer otra
      setSelectedFinished(null);
      setQuantity("");
      setNotes("");
    },
    onError: (err: any) => {
      toastError(
        err.response?.data?.message || "Error al realizar la transformación",
      );
    },
  });

  const handleSubmit = () => {
    if (!selectedRaw || !selectedFinished || !quantity) {
      toastError("Selecciona un producto, una opción y la cantidad.");
      return;
    }

    const qty = Number(quantity);
    if (qty <= 0) {
      toastError("La cantidad debe ser mayor a 0");
      return;
    }

    if (qty > selectedRaw.quantity) {
      toastError(
        `No tienes suficiente stock. Máximo disponible: ${selectedRaw.quantity}`,
      );
      return;
    }

    // Aquí enviamos la información exacta al nuevo backend:
    mutation.mutate({
      raw_product_id: Number(selectedRaw.product_variant?.product_id),
      finished_product_id: Number(selectedFinished.finished_product_id),
      quantity: qty,
      notes: notes || undefined,
    });
  };

  if (loadingRaw) {
    return (
      <div className="text-center py-12 text-gray-600">
        Cargando inventario...
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[75vh]">
      {/* ================= PANEL IZQUIERDO: LISTA BUSCABLE ================= */}
      <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Stock Materia Prima
          </h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por SKU o Nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {filteredRawStock.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">
              No se encontraron productos raw.
            </p>
          ) : (
            filteredRawStock.map((item: StockItem) => {
              const sku =
                item.product_variant?.sku ||
                `M-${item.product_variant?.product?.base_code}`;
              const isSelected = selectedRaw?.id === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedRaw(item)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-blue-50 border-blue-500 shadow-sm"
                      : "bg-white border-gray-100 hover:border-blue-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{sku}</p>
                      <p className="text-xs text-gray-600 line-clamp-1">
                        {item.product_variant?.product?.name}
                      </p>
                    </div>
                    <div className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-lg">
                      {item.quantity} und
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ================= PANEL DERECHO: DETALLES Y ACCIÓN ================= */}
      <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col">
        {!selectedRaw ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
            <span className="text-6xl mb-4">📦</span>
            <h3 className="text-xl font-medium">Selecciona un producto</h3>
            <p className="text-sm">
              Usa la lista de la izquierda para empezar una transformación.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-6 lg:p-8">
            {/* Header del seleccionado */}
            <div className="mb-6 pb-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedRaw.product_variant?.product?.name}
              </h2>
              <div className="flex gap-4 mt-2">
                <span className="bg-purple-100 text-purple-800 text-sm font-semibold px-3 py-1 rounded-full">
                  SKU:{" "}
                  {selectedRaw.product_variant?.sku ||
                    `M-${selectedRaw.product_variant?.product?.base_code}`}
                </span>
                <span className="bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full">
                  Stock disponible: {selectedRaw.quantity}
                </span>
              </div>
            </div>

            {/* Opciones de transformación */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                1. ¿A qué producto deseas transformarlo?
              </h3>

              {loadingOptions ? (
                <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-xl">
                  Buscando opciones...
                </div>
              ) : possibleFinished.length === 0 ? (
                <div className="p-6 text-center text-red-600 bg-red-50 rounded-xl border border-red-100">
                  Este producto no tiene transformaciones configuradas por el
                  administrador.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {possibleFinished.map((finished) => {
                    const isSelected =
                      selectedFinished?.finished_product_id ===
                      finished.finished_product_id;
                    return (
                      <button
                        key={finished.finished_product_id}
                        onClick={() => setSelectedFinished(finished)}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 shadow-md"
                            : "border-gray-200 bg-white hover:border-blue-300"
                        }`}
                      >
                        <p className="font-bold text-gray-900 text-sm mb-1">
                          {finished.sku}
                        </p>
                        <p className="text-xs text-gray-600">
                          {finished.finished_product_name}
                        </p>
                        {finished.notes && (
                          <p className="text-xs text-blue-600 mt-2 bg-blue-100 inline-block px-2 py-0.5 rounded">
                            {finished.notes}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Formulario final (Solo se muestra si hay una opción seleccionada) */}
            {selectedFinished && (
              <div className="mt-auto bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  2. Ingresa los detalles
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cantidad a usar *
                    </label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      max={selectedRaw.quantity}
                      min={1}
                      placeholder={`Max: ${selectedRaw.quantity}`}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notas del operario (Opcional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej: Transformación solicitada por Tienda 1"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={mutation.isPending || !quantity}
                  className="w-full bg-blue-600 text-white font-bold text-lg py-4 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {mutation.isPending
                    ? "Procesando..."
                    : "Confirmar Transformación"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
