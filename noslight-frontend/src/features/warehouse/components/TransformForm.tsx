// src/features/warehouse/components/TransformForm.tsx
import { useState, useEffect, useRef } from "react";
import { useRawStock } from "../hooks/useWarehouse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { performTransform } from "../api/warehouseApi";
import { useToast } from "@/components/ToastProvider";
import axios from "@/lib/axios";
import { StockItem } from "../types";

export default function TransformForm() {
  const { data: rawProductsData = [], isLoading: loadingRaw } = useRawStock();
  const { error: toastError } = useToast();
  const queryClient = useQueryClient();

  // Estados de la interfaz
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRaw, setSelectedRaw] = useState<StockItem | null>(null);

  // 🟢 AGREGA ESTE NUEVO ESTADO AQUÍ:
  const [visibleCount, setVisibleCount] = useState(15);

  // 🟢 AGREGA ESTE EFECTO PARA REINICIAR EL LÍMITE AL BUSCAR:
  useEffect(() => {
    setVisibleCount(10);
  }, [searchTerm]);



  // Estados del formulario (Detalle)
  const [possibleFinished, setPossibleFinished] = useState<any[]>([]);
  const [selectedFinished, setSelectedFinished] = useState<any | null>(null);
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [transformStatus, setTransformStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const mutateStartRef = useRef<number | null>(null);
  // Confirmación antes de ejecutar la transformación
  const [showConfirm, setShowConfirm] = useState(false);

  const MIN_PENDING_MS = 600; // ensure pending visible at least this long
  const SUCCESS_VISIBLE_MS = 1000;
  const ERROR_VISIBLE_MS = 2000;

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
    // If no selection, clear and exit
    if (!selectedRaw) {
      setPossibleFinished([]);
      setSelectedFinished(null);
      setQuantity("");
      return;
    }

    // Avoid fetching options while a transformation is pending
    if (transformStatus === "pending") {
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
  }, [selectedRaw]);

  // Ejecutar transformación
  const mutation = useMutation({
    mutationFn: performTransform,
    // Optimistic update: decrement local selectedRaw and cache immediately
    onMutate: async (newTransform: any) => {
      mutateStartRef.current = Date.now();
      setTransformStatus("pending");
      await queryClient.cancelQueries({ queryKey: ["rawStock"] });
      const previousRawStock = queryClient.getQueryData<any[]>(["rawStock"]);

      // update cache optimistically
      queryClient.setQueryData(["rawStock"], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((it) => {
          if (selectedRaw && it.id === selectedRaw.id) {
            const newQty = Math.max(0, (it.quantity || 0) - (newTransform.quantity || 0));
            return { ...it, quantity: newQty };
          }
          return it;
        });
      });

      // update local selectedRaw for immediate UI feedback
      setSelectedRaw((prev) => {
        if (!prev) return prev;
        const newQty = Math.max(0, (prev.quantity || 0) - (newTransform.quantity || 0));
        return { ...prev, quantity: newQty } as typeof prev;
      });

      return { previousRawStock };
    },
    onError: (err: any, _vars: any, context: any) => {
      // rollback cache immediately
      if (context?.previousRawStock) {
        queryClient.setQueryData(["rawStock"], context.previousRawStock);
        if (selectedRaw) {
          const original = context.previousRawStock?.find((i: any) => i.id === selectedRaw.id);
          if (original) setSelectedRaw(original);
        }
      }

      const elapsed = mutateStartRef.current ? Date.now() - mutateStartRef.current : MIN_PENDING_MS;
      const wait = Math.max(0, MIN_PENDING_MS - elapsed);

      // after ensuring minimum pending duration, show error animation then toast
      setTimeout(() => {
        setTransformStatus("error");
        setTimeout(() => {
          toastError(err.response?.data?.message || "Error al realizar la transformación");
          setTransformStatus("idle");
        }, ERROR_VISIBLE_MS);
      }, wait);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["rawStock"] });
      queryClient.invalidateQueries({ queryKey: ["finishedStock"] });
    },
    onSuccess: () => {
      const elapsed = mutateStartRef.current ? Date.now() - mutateStartRef.current : MIN_PENDING_MS;
      const wait = Math.max(0, MIN_PENDING_MS - elapsed);

      setTimeout(() => {
        setTransformStatus("success");
        setTimeout(() => {
          // limpiar formulario y volver a idle
          setSelectedFinished(null);
          setQuantity("");
          setNotes("");
          setTransformStatus("idle");
        }, SUCCESS_VISIBLE_MS);
      }, wait);
    },
  });

  // Keep selectedRaw in sync with server data when rawProductsData refetches
  useEffect(() => {
    if (!selectedRaw) return;
    const updated = rawProductsData.find((i: any) => i.id === selectedRaw.id);
    if (updated && updated.quantity !== selectedRaw.quantity) {
      setSelectedRaw(updated);
    }
  }, [rawProductsData]);

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

    // Abrir diálogo de confirmación en vez de mutar inmediatamente
    setShowConfirm(true);
  };

  const confirmAndSubmit = () => {
    if (!selectedRaw || !selectedFinished || !quantity) {
      setShowConfirm(false);
      return;
    }

    const qty = Number(quantity);
    mutation.mutate({
      raw_product_id: Number(selectedRaw.product_variant?.product_id),
      finished_product_id: Number(selectedFinished.finished_product_id),
      quantity: qty,
      notes: notes || undefined,
    });
    setShowConfirm(false);
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

        {/*<div className="flex-1 overflow-y-auto p-2 space-y-2">
          {filteredRawStock.filter((item: StockItem) => {
            // Evaluamos cómo viene el SKU exactamente igual a como lo pintas abajo
            const sku = item.product_variant?.sku || `M-${item.product_variant?.product?.base_code}`;
            // ⚡ SOLO dejamos pasar los que comiencen con "M-"
            return sku && sku.startsWith('M-');
          }).length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">
              No se encontraron productos raw.
            </p>
          ) : (
            filteredRawStock
              .filter((item: StockItem) => {
                const sku = item.product_variant?.sku || `M-${item.product_variant?.product?.base_code}`;
                return sku && sku.startsWith('M-');
              })
              .map((item: StockItem) => {
                const sku =
                  item.product_variant?.sku ||
                  `M-${item.product_variant?.product?.base_code}`;
                const isSelected = selectedRaw?.id === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedRaw(item)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected
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
        </div>*/}

        {/* 🟢 PEGA ESTE BLOQUE OPTIMIZADO AQUÍ: */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {(() => {
            const rawFiltradosCompletos = filteredRawStock.filter((item: StockItem) => {
              const sku = item.product_variant?.sku || `M-${item.product_variant?.product?.base_code}`;
              return sku && sku.startsWith('M-');
            });

            if (rawFiltradosCompletos.length === 0) {
              return (
                <p className="text-center text-gray-500 py-8 text-sm">
                  No se encontraron productos raw.
                </p>
              );
            }

            const itemsVisibles = rawFiltradosCompletos.slice(0, visibleCount);

            return (
              <>
                {itemsVisibles.map((item: StockItem) => {
                  const sku = item.product_variant?.sku || `M-${item.product_variant?.product?.base_code}`;
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
                })}

                {rawFiltradosCompletos.length > visibleCount && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 15)}
                    className="w-full py-2.5 mt-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all border border-gray-200 shadow-sm text-center cursor-pointer"
                  >
                    ➕ Ver más productos ({rawFiltradosCompletos.length - visibleCount} restantes)
                  </button>
                )}
              </>
            );
          })()}
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
                        disabled={mutation.isPending}
                        aria-disabled={mutation.isPending}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${isSelected
                          ? "border-blue-600 bg-blue-50 shadow-md"
                          : "border-gray-200 bg-white hover:border-blue-300"
                          } ${mutation.isPending ? 'opacity-60 pointer-events-none' : ''}`}
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
              <div className="mt-auto bg-gray-50 p-6 rounded-2xl border border-gray-200 relative">
                {transformStatus !== "idle" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
                    <div className="flex items-center gap-3 px-6 py-4 bg-white/90 rounded-lg shadow-lg">
                      {transformStatus === "pending" && (
                        <>
                          <svg className="w-6 h-6 animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                          </svg>
                          <span className="text-sm font-medium text-gray-700">Procesando transformación...</span>
                        </>
                      )}
                      {transformStatus === "success" && (
                        <>
                          <svg className="w-8 h-8 text-green-600 transform animate-pop" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm font-medium text-gray-700">Transformación exitosa</span>
                        </>
                      )}
                      {transformStatus === "error" && (
                        <>
                          <svg className="w-8 h-8 text-red-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-sm font-medium text-gray-700">Error: no se pudo transformar</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
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
                      disabled={mutation.isPending}
                      aria-disabled={mutation.isPending}
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
                      disabled={mutation.isPending}
                      aria-disabled={mutation.isPending}
                    />
                  </div>
                </div>

                {/* Dialogo de confirmación antes de enviar */}
                {showConfirm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
                      <h4 className="text-lg font-bold mb-2">Confirma transformación</h4>
                      <p className="text-sm text-gray-700 mb-4">
                        ¿Estás seguro de transformar <strong>{selectedRaw.product_variant?.product?.name}</strong>
                        {` (${selectedRaw.product_variant?.sku || `M-${selectedRaw.product_variant?.product?.base_code}`}) `}
                        a <strong>{selectedFinished.finished_product_name}</strong> en cantidad <strong>{quantity}</strong>?
                      </p>
                      <div className="flex gap-3 justify-end">
                        <button
                          type="button"
                          onClick={() => setShowConfirm(false)}
                          disabled={mutation.isPending}
                          className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={confirmAndSubmit}
                          disabled={mutation.isPending}
                          className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50"
                        >
                          {mutation.isPending ? 'Procesando...' : 'Sí, transformar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={mutation.isPending || !quantity}
                  aria-busy={mutation.isPending}
                  className="w-full bg-blue-600 text-white font-bold text-lg py-4 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-3"
                >
                  {mutation.isPending && (
                    <svg className="w-5 h-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                  )}
                  <span>{mutation.isPending ? 'Procesando...' : 'Confirmar Transformación'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
