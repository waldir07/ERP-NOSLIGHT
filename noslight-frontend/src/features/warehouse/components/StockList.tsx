// src/features/warehouse/components/StockList.tsx
import { useState } from "react";
import { useRawStock, useFinishedStock } from "../hooks/useWarehouse";
import axios from "@/lib/axios";
import { useToast } from "@/components/ToastProvider";

export default function StockList({ type }: { type: "raw" | "finished" }) {
  const { success, error: toastError } = useToast();
  const {
    data: rawData = [],
    isLoading,
    refetch,
  } = type === "raw" ? useRawStock() : useFinishedStock();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<any[]>([]); // Lista de IDs seleccionados
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const [isSending, setIsSending] = useState(false); // Nuevo estado

  const [loading, setLoading] = useState(false);

  // src/features/warehouse/components/StockList.tsx
  const groupedStock = rawData.reduce((acc: any, current: any) => {
    const variant = current.product_variant;
    const product = variant?.product;

    if (!product) return acc;

    // --- CORRECCIÓN BASADA EN TU CONSOLA ---
    // Usamos el is_raw que viene directamente en 'current' o en 'product'
    const isRaw = Number(current.is_raw) === 1 || Number(product.is_raw) === 1;
    const isDirect = Number(product.is_direct_sale) === 1;

    if (type === "raw") {
      if (!isRaw) return acc;
    } else {
      // Si es materia prima Y NO es venta directa, lo sacamos
      if (isRaw && !isDirect) return acc;
    }
    // ---------------------------------------

    const variantId = current.product_variant_id;
    if (!acc[variantId]) {
      let displaySku = variant.sku || product.base_code;
      if (type === "finished" && isDirect && displaySku.startsWith("M-")) {
        displaySku = displaySku.substring(2);
      }

      acc[variantId] = {
        variant_id: variantId,
        product_id: product.id,
        sku: displaySku,
        name: product.name,
        is_direct: isDirect,
        almacen_qty: 0,
        tienda_qty: 0,
      };
    }

    const qty = Number(current.quantity) || 0;
    if (current.warehouse?.code === "TIENDA") {
      acc[variantId].tienda_qty += qty;
    } else {
      acc[variantId].almacen_qty += qty;
    }

    return acc;
  }, {});

  // LOG DE DEPURACIÓN (Míralo en la consola F12)
  console.log(`Filtrando para pestaña ${type}:`, Object.values(groupedStock));

  const displayStock = Object.values(groupedStock).filter(
    (item: any) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // --- LÓGICA DE SELECCIÓN ---
  const toggleSelect = (item: any) => {
    if (selectedItems.find((i) => i.variant_id === item.variant_id)) {
      setSelectedItems(
        selectedItems.filter((i) => i.variant_id !== item.variant_id),
      );
    } else {
      setSelectedItems([...selectedItems, item]);
      setQuantities({ ...quantities, [item.variant_id]: 1 });
    }
  };

  const handleBulkSend = async () => {
    if (loading || selectedItems.length === 0) return;
    setLoading(true); // Bloqueamos el botón inmediatamente
    if (isSending) return; // Evita doble envío
    setIsSending(true);

    try {
      const itemsToSend = selectedItems.map((item) => ({
        product_id: item.product_id,
        quantity: quantities[item.variant_id] || 0,
      }));

      const res = await axios.post("/api/transfers/bulk-send", {
        items: itemsToSend,
      });

      success("Envío registrado correctamente");

      // Aquí abriremos el modal de resumen o la impresión directamente
      // window.open(`/print/transfer/${res.data.transfer_id}`, '_blank');

      setSelectedItems([]);
      setIsModalOpen(false);
      refetch(); // Recargar el stock
    } catch (err: any) {
      toastError(err.response?.data?.message || "Error en el envío");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="bg-white p-6 rounded-3xl shadow-sm flex justify-between items-center border border-gray-100">
        <h2 className="text-xl font-black text-gray-800 tracking-tight">
          {type === "raw" ? "📦 Materia Prima" : "✅ Listos para Tienda"}
        </h2>

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Buscar..."
            className="px-4 py-2 bg-gray-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {selectedItems.length > 0 && type === "finished" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-green-600 text-white px-6 py-2 rounded-xl font-black text-sm shadow-lg shadow-green-100 animate-bounce"
            >
              ENVIAR SELECCIONADOS ({selectedItems.length})
            </button>
          )}
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {type === "finished" && <th className="px-6 py-4 w-10"></th>}
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">
                Producto
              </th>
              <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase">
                En Almacén
              </th>
              <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase">
                En Tienda
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayStock.map((item: any) => (
              <tr
                key={item.variant_id}
                className={`transition-colors ${selectedItems.find((i) => i.variant_id === item.variant_id) ? "bg-blue-50/50" : "hover:bg-gray-50"}`}
              >
                {type === "finished" && (
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      className="rounded text-blue-600 w-5 h-5 border-gray-300"
                      checked={
                        !!selectedItems.find(
                          (i) => i.variant_id === item.variant_id,
                        )
                      }
                      onChange={() => toggleSelect(item)}
                      disabled={item.almacen_qty <= 0}
                    />
                  </td>
                )}
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] font-bold text-blue-600 mb-1">
                      {item.sku}
                    </span>
                    <span className="font-bold text-gray-800 text-sm leading-tight">
                      {item.name}
                    </span>
                    {item.is_direct && (
                      <span className="inline-block mt-1 text-[9px] font-black text-purple-600 bg-purple-50 w-fit px-2 py-0.5 rounded-full border border-purple-100">
                        ✨ IMPORTACIÓN DIRECTA
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-center font-black text-gray-700">
                  {item.almacen_qty}
                </td>
                <td className="px-6 py-4 text-center font-black text-gray-400">
                  {item.tienda_qty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL UNIFICADO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[40px] p-10 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-3xl font-black text-gray-800 mb-2">
              Resumen de Envío
            </h3>
            <p className="text-gray-500 mb-8 font-medium font-serif">
              Consolidando productos para salida a tienda.
            </p>

            <div className="space-y-4 mb-10">
              {selectedItems.map((item) => (
                <div
                  key={item.variant_id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-3xl border border-gray-100"
                >
                  <div className="flex-1">
                    <p className="font-black text-gray-800 text-sm leading-none mb-1">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">
                      {item.sku} • Stock: {item.almacen_qty}
                    </p>
                  </div>
                  <input
                    type="number"
                    className="w-24 border-2 border-gray-200 rounded-2xl p-2 text-center font-black outline-none focus:border-blue-500"
                    value={quantities[item.variant_id]}
                    max={item.almacen_qty}
                    min={1}
                    onChange={(e) =>
                      setQuantities({
                        ...quantities,
                        [item.variant_id]: Number(e.target.value),
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-4 font-bold text-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkSend}
                className="flex-1 bg-gray-900 text-white py-4 rounded-3xl font-black hover:bg-black shadow-xl"
              >
                CONFIRMAR SALIDA TOTAL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
