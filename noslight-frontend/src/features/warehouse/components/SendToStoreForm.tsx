import { useState } from 'react';

interface Product {
  id: number;
  name: string;
  base_code: string;
  is_raw: boolean;
  amperage?: number | null;   // 🟢 Añadimos el amperaje a la interfaz
  is_direct_sale?: boolean; // 🟢 Añadimos la bandera de venta directa
}

export default function SendToStoreForm({ products, onSend }: { products: Product[], onSend: (data: any) => void }) {
  const [form, setForm] = useState({ product_id: '', quantity: 1 });

  // 🧠 REGLA INTELIGENTE: Mostramos productos terminados O productos Raw autorizados para venta directa
  const allowedProducts = products.filter(p => !p.is_raw || p.is_direct_sale);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Buscamos el objeto completo del producto que seleccionó el operario
    const selectedProduct = products.find(p => p.id === Number(form.product_id));

    // Mandamos el formulario enriquecido con el amperaje exacto del producto
    onSend({
      product_id: Number(form.product_id),
      quantity: form.quantity,
      amperage: selectedProduct ? selectedProduct.amperage : 0 // 🟢 ¡Enviamos el amperaje a Laravel!
    });
  };

  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl max-w-md mx-auto">
      <div className="text-center mb-6">
        <span className="text-4xl">🚚</span>
        <h2 className="text-2xl font-black text-gray-800 mt-2">Enviar a Tienda</h2>
        <p className="text-gray-500 text-sm font-medium">Mover stock para la venta en vitrina</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Seleccionar Producto</label>
          <select 
            className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 font-bold outline-none focus:border-green-500 transition-all"
            value={form.product_id}
            onChange={(e) => setForm({...form, product_id: e.target.value})}
            required
          >
            <option value="">-- Seleccionar --</option>
            {allowedProducts.map(p => {
              // Si es un producto base raw con permiso de venta directa, le pintamos su prefijo M-
              const displayName = p.is_raw ? `M-${p.base_code}` : p.base_code;
              return (
                <option key={p.id} value={p.id}>
                  {p.name} [{displayName}] - {p.amperage}A
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Cantidad a enviar</label>
          <input 
            type="number"
            min="1"
            className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 font-black outline-none focus:border-green-500"
            value={form.quantity}
            onChange={(e) => setForm({...form, quantity: Number(e.target.value)})}
            required
          />
        </div>

        <button 
          type="submit"
          className="w-full bg-green-600 text-white py-5 rounded-2xl font-black hover:bg-green-700 shadow-xl shadow-green-100 transition-all active:scale-95"
        >
          DESPACHAR A TIENDA
        </button>
      </form>
    </div>
  );
}