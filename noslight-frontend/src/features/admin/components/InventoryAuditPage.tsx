import { useEffect, useState } from 'react';
import { useToast } from '@/components/ToastProvider';

interface UnifiedProduct {
  product_id: number;
  variant_id: number | null;
  name: string;
  base_code: string;
  sku: string;
  brand: string;
  amperage: number;
  is_raw: boolean;
  current_stock: number;
  warehouse_name: string;
}

export default function InventoryAuditPage() {
  const [items, setItems] = useState<UnifiedProduct[]>([]);
  const [rowQuantities, setRowQuantities] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'RAW' | 'FINISHED'>('ALL');

  const { success, error } = useToast();

  // Paginación y Filtros
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const [processingKey, setProcessingKey] = useState<string | null>(null);

  // 1. Debounce para el buscador (espera 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Si buscas algo nuevo, regresamos a la página 1
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. Efecto para recargar cuando cambia la página, la búsqueda o el filtro
  useEffect(() => {
    loadUnifiedStock(page, debouncedSearch, filterType);
  }, [page, debouncedSearch, filterType]);

  const loadUnifiedStock = async (currentPage: number, search: string, type: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("noslight_token");
      // Ahora enviamos los parámetros a Laravel
      const url = new URL(import.meta.env.VITE_API_URL + "/api/admin/inventory/unified-list");
      url.searchParams.append('page', currentPage.toString());
      if (search) url.searchParams.append('search', search);
      url.searchParams.append('type', type);

      const res = await fetch(url.toString(), {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        // Laravel paginate() devuelve los items dentro de 'data' y la última página en 'last_page'
        setItems(data.data || []);
        setLastPage(data.last_page || 1);
      }
    } catch (err) {
      error("No se pudo cargar el catálogo.");
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (key: string, value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setRowQuantities({ ...rowQuantities, [key]: value });
    }
  };


  // 3. Función maestra que maneja sumas y restas
  const handleAjuste = async (item: UnifiedProduct, key: string, accion: 'SUMAR' | 'RESTAR') => {
    const qtyStr = rowQuantities[key] || '';
    let quantity = parseInt(qtyStr);

    if (!qtyStr || quantity <= 0) {
      error("⚠️ Ingresa una cantidad válida mayor a 0.");
      return;
    }

    // Si es restar, convertimos el número a negativo para Laravel
    if (accion === 'RESTAR') {
      quantity = -Math.abs(quantity);
    }

    // 👇 1. BLOQUEAMOS LOS BOTONES DE ESTA FILA 👇
    setProcessingKey(key);

    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch(import.meta.env.VITE_API_URL + "/api/admin/inventory/inject-row", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: quantity // Puede ser 10 (Suma) o -10 (Resta)
        })
      });

      if (res.ok) {
        const data = await res.json();
        const mensaje = accion === 'SUMAR' 
          ? `🚀 ${item.sku}: ¡Se inyectaron +${Math.abs(quantity)} unidades con éxito!`
          : `📉 ${item.sku}: ¡Se descontaron -${Math.abs(quantity)} unidades!`;
        
        success(mensaje);
        
        setItems(prev => prev.map(p => {
          const matchCondition = p.product_id === item.product_id && p.variant_id === item.variant_id;
          return matchCondition ? { ...p, current_stock: data.new_stock } : p;
        }));
        setRowQuantities(prev => ({ ...prev, [key]: '' }));
      } else {
        // 👇 AHORA LEEMOS EL MENSAJE DE ERROR QUE ENVÍA LARAVEL 👇
        const errorData = await res.json();
        error(errorData.message || "Error al procesar el ajuste de stock.");
      }
    } catch (err) {
      error("Error de comunicación con el servidor.");
    } finally {
      // 👇 2. PASE LO QUE PASE (éxito o error), DESBLOQUEAMOS LOS BOTONES 👇
      setProcessingKey(null);
    }
  };





  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-800">🛠️ PANEL MAESTRO DE AJUSTES</h1>
          <p className="text-gray-500 font-medium">Control total (Modo Dios): Suma o resta inventario de forma inmediata.</p>
        </div>
        {/* Tu firma y versión aquí */}
        <div className="text-right">
          <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
            v1.1.0
          </span>
          <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-widest">
            Hecho por Waldir
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="🔍 Buscar por SKU, código base o nombre del interruptor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-white border rounded-2xl px-4 py-3 font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        />

        <div className="flex bg-white border p-1 rounded-2xl shadow-sm font-bold text-xs">
          <button onClick={() => { setFilterType('ALL'); setPage(1); }} className={`px-4 py-2 rounded-xl transition-all ${filterType === 'ALL' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Todos</button>
          <button onClick={() => { setFilterType('RAW'); setPage(1); }} className={`px-4 py-2 rounded-xl transition-all ${filterType === 'RAW' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>📦 Solo Base (Raw)</button>
          <button onClick={() => { setFilterType('FINISHED'); setPage(1); }} className={`px-4 py-2 rounded-xl transition-all ${filterType === 'FINISHED' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>🏪 Store (Terminados)</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white text-[11px] uppercase tracking-widest">
              <th className="px-6 py-4">Código SKU</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Descripción</th>
              <th className="px-6 py-4 text-center">Stock Actual</th>
              <th className="px-6 py-4 text-center w-80">Ajuste Manual</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 font-medium text-sm">
            {loading ? (
              <tr><td colSpan={5} className="p-10 text-center font-bold text-gray-500 animate-pulse">Cargando catálogo...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="p-12 text-center text-gray-400 font-bold">No se encontraron productos.</td></tr>
            ) : (
              items.map((item) => {
                const rowKey = `${item.product_id}-${item.variant_id || '0'}`;
                return (
                  <tr key={rowKey} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-black text-gray-900">{item.sku}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${item.is_raw ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                        {item.is_raw ? '📦 Base' : '🏪 Terminado'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900 font-bold">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 text-center font-black text-base bg-gray-50 text-gray-800">
                      {item.current_stock}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-center">
                        <input
                          type="text"
                          placeholder="Cant."
                          value={rowQuantities[rowKey] || ''}
                          onChange={(e) => handleQtyChange(rowKey, e.target.value)}
                          className="w-16 text-center bg-gray-50 border border-gray-300 rounded-xl py-1.5 font-bold outline-none focus:border-gray-500 focus:bg-white"
                        />
                        <button
                          onClick={() => handleAjuste(item, rowKey, 'SUMAR')}
                          disabled={processingKey === rowKey}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center shadow-sm ${processingKey === rowKey
                              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                        >
                          {processingKey === rowKey ? '⏳...' : '+ Añadir'}
                        </button>

                        <button
                          onClick={() => handleAjuste(item, rowKey, 'RESTAR')}
                          disabled={processingKey === rowKey}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center shadow-sm ${processingKey === rowKey
                              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                              : 'bg-red-500 hover:bg-red-600 text-white'
                            }`}
                        >
                          {processingKey === rowKey ? '⏳...' : '- Restar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Controles de Paginación */}
        {!loading && items.length > 0 && (
          <div className="bg-gray-50 p-4 border-t flex justify-between items-center text-sm font-bold text-gray-600">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 bg-white border rounded-xl disabled:opacity-50 hover:bg-gray-100"
            >
              &larr; Anterior
            </button>
            <span>Página {page} de {lastPage}</span>
            <button
              disabled={page === lastPage}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 bg-white border rounded-xl disabled:opacity-50 hover:bg-gray-100"
            >
              Siguiente &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}