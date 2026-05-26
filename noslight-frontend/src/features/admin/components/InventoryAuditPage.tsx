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

  const loadUnifiedStock = async () => {
    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch("import.meta.env.VITE_API_URL/api/admin/inventory/unified-list", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      error("No se pudo cargar la lista unificada de inventario.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUnifiedStock(); }, []);

  const handleQtyChange = (key: string, value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setRowQuantities({ ...rowQuantities, [key]: value });
    }
  };

  const handleInjectRow = async (item: UnifiedProduct, key: string) => {
    const qtyStr = rowQuantities[key] || '';
    const quantity = parseInt(qtyStr);

    if (!qtyStr || quantity <= 0) {
      error("⚠️ Ingresa una cantidad válida mayor a 0.");
      return;
    }

    try {
      const token = localStorage.getItem("noslight_token");
      const res = await fetch("import.meta.env.VITE_API_URL/api/admin/inventory/inject-row", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: quantity
        })
      });

      if (res.ok) {
        const data = await res.json();
        success(`🚀 ${item.sku}: ¡Se inyectaron +${quantity} unidades con éxito!`);
        
        // Actualizamos dinámicamente el stock actual en la pantalla sin recargar todo
        setItems(prev => prev.map(p => {
          const matchCondition = p.product_id === item.product_id && p.variant_id === item.variant_id;
          return matchCondition ? { ...p, current_stock: data.new_stock } : p;
        }));

        // Limpiamos la cajita de texto de esa fila
        setRowQuantities(prev => ({ ...prev, [key]: '' }));
      } else {
        error("Error al procesar la inyección de stock.");
      }
    } catch (err) {
      error("Error de comunicación con el servidor.");
    }
  };

  // Filtrado combinado por buscador y por tipo de producto (Raw vs Terminado)
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterType === 'RAW') return matchesSearch && item.is_raw;
    if (filterType === 'FINISHED') return matchesSearch && !item.is_raw;
    return matchesSearch;
  });

  if (loading) return <div className="p-10 text-center font-bold">Cargando catálogo maestro unificado...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-800">📥 PANEL MAESTRO DE INYECCIÓN DE INVENTARIO</h1>
        <p className="text-gray-500 font-medium">Visualiza el stock en tiempo real e inyecta saldos iniciales de forma directa por producto.</p>
      </div>

      {/* Barra de Herramientas: Buscador + Filtros rápidos */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="🔍 Buscar por SKU, código base o nombre del interruptor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-white border rounded-2xl px-4 py-3 font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        />

        <div className="flex bg-white border p-1 rounded-2xl shadow-sm font-bold text-xs">
          <button 
            onClick={() => setFilterType('ALL')}
            className={`px-4 py-2 rounded-xl transition-all ${filterType === 'ALL' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Todos ({items.length})
          </button>
          <button 
            onClick={() => setFilterType('RAW')}
            className={`px-4 py-2 rounded-xl transition-all ${filterType === 'RAW' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            📦 Solo Base (Raw)
          </button>
          <button 
            onClick={() => setFilterType('FINISHED')}
            className={`px-4 py-2 rounded-xl transition-all ${filterType === 'FINISHED' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Store (Terminados)
          </button>
        </div>
      </div>

      {/* Tabla Unificada */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white text-[11px] uppercase tracking-widest">
              <th className="px-6 py-4">Código SKU</th>
              <th className="px-6 py-4">Tipo de Producto</th>
              <th className="px-6 py-4">Descripción Maestra</th>
              <th className="px-6 py-4 text-center">Amperaje</th>
              <th className="px-6 py-4 text-center bg-gray-900/10">Stock Actual</th>
              <th className="px-6 py-4 text-center w-64">Acción de Inyección Directa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-medium text-sm">
            {filteredItems.map((item) => {
              const rowKey = `${item.product_id}-${item.variant_id || '0'}`;
              return (
                <tr key={rowKey} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-6 py-4 font-mono font-black text-gray-900">{item.sku}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase ${
                      item.is_raw ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'bg-green-50 text-green-700 border border-green-200'
                    }`}>
                      {item.is_raw ? '📦 Base (Raw)' : '🏪 Terminado'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900 font-bold">{item.name}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider">{item.brand}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-bold text-xs">
                      {item.amperage}A
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-black text-base bg-gray-50 text-gray-800">
                    {item.current_stock}
                    <div className="text-[9px] text-gray-400 font-medium font-sans uppercase tracking-tight">
                      En {item.warehouse_name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-center">
                      <input
                        type="text"
                        placeholder="Cantidad"
                        value={rowQuantities[rowKey] || ''}
                        onChange={(e) => handleQtyChange(rowKey, e.target.value)}
                        className="w-20 text-center bg-gray-50 border border-gray-300 rounded-xl py-1.5 font-bold text-blue-600 outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                      <button
                        onClick={() => handleInjectRow(item, rowKey)}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow transition-all flex items-center gap-1 shrink-0"
                      >
                        ➕ Inyectar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredItems.length === 0 && (
          <div className="p-12 text-center text-gray-400 font-bold">No se encontraron productos en la base de datos maestro.</div>
        )}
      </div>
    </div>
  );
}