import { useState } from 'react';

interface Product {
  id: number;
  name: string;
  base_code: string;
  is_raw: boolean;
}

interface AdjustmentFormProps {
  products: Product[];
  onSave: (data: any) => void;
  userRole: string;
}

export default function AdjustmentForm({ products, onSave, userRole }: AdjustmentFormProps) {
  // 1. Filtrar productos según el rol: Warehouse solo ve RAW, Store solo ve TERMINADOS
  const filteredProducts = products.filter(p => {
    if (userRole === 'WAREHOUSE') return p.is_raw;
    if (userRole === 'STORE') return !p.is_raw;
    return true; // Admin ve todo
  });

  const [formData, setFormData] = useState({
    product_id: '',
    // Si es STORE el ID de almacen es 2, sino 1 (Warehouse o Admin por defecto)
    warehouse_id: userRole === 'STORE' ? 2 : 1,
    type: 'DECREMENT',
    quantity: '',
    reason: userRole === 'WAREHOUSE' ? 'FALLA_ORIGEN' : 'MALOGRADO_EXHIBICION',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id) return alert("Selecciona un producto");
    if (Number(formData.quantity) <= 0) return alert("La cantidad debe ser mayor a 0");
    onSave(formData);
  };

  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-amber-100 rounded-2xl text-amber-600 text-xl">🔧</div>
        <div>
          <h2 className="text-2xl font-black text-gray-800">Solicitar Ajuste</h2>
          <p className="text-sm text-gray-500 font-medium">Panel de {userRole}</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Producto */}
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">
            {userRole === 'WAREHOUSE' ? 'Materia Prima (Raw)' : 'Producto Terminado'}
          </label>
          <select 
            className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 focus:border-blue-500 outline-none transition-all font-bold text-gray-700"
            value={formData.product_id}
            onChange={(e) => setFormData({...formData, product_id: e.target.value})}
            required
          >
            <option value="">-- Seleccionar producto --</option>
            {filteredProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name} [{p.base_code}]</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Acción</label>
            <select 
              className={`w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 font-bold outline-none ${formData.type === 'DECREMENT' ? 'text-red-600' : 'text-green-600'}`}
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
            >
              <option value="DECREMENT">➖ Salida / Merma</option>
              <option value="INCREMENT">➕ Entrada / Ajuste</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Cantidad</label>
            <input 
              type="number"
              className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 font-black outline-none focus:border-blue-500"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              placeholder="0"
              required
            />
          </div>
        </div>

        {/* Motivos Condicionales */}
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Motivo Específico</label>
          <select 
            className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 font-bold text-gray-700 outline-none"
            value={formData.reason}
            onChange={(e) => setFormData({...formData, reason: e.target.value})}
          >
            {userRole === 'WAREHOUSE' ? (
              <>
                <option value="FALLA_ORIGEN">🚢 Falla de Origen (Importación)</option>
                <option value="MALOGRADO">📦 Malogrado en Almacén</option>
                <option value="ERROR_CONTEO">🔢 Error de Inventario</option>
              </>
            ) : (
              <>
                <option value="MALOGRADO_EXHIBICION">🏪 Malogrado en Exhibición</option>
                <option value="DEVOLUCION_FALLA">🔙 Devolución por Falla</option>
                <option value="CAMBIO_PRODUCTO">🔄 Cambio de Producto</option>
                <option value="ERROR_CONTEO">🔢 Error de Inventario</option>
              </>
            )}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Notas / Justificación</label>
          <textarea 
            className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 outline-none focus:border-blue-500 min-h-[100px]"
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            placeholder="Explica qué pasó..."
          />
        </div>

        <button 
          type="submit"
          className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-95"
        >
          ENVIAR SOLICITUD DE AJUSTE
        </button>
      </form>
    </div>
  );
}