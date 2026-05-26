import { useAdminProducts } from '../../admin/hooks/useAdminProducts';
import SendToStoreForm from '../components/SendToStoreForm';
import axios from '@/lib/axios';
import { useToast } from '@/components/ToastProvider';

export default function SendToStorePage() {
  const { data: products = [], isLoading } = useAdminProducts();
  const { success, error } = useToast();

  const handleSend = async (formData: any) => {
    try {
      await axios.post('/api/transfers/send-to-store', {
        product_id: Number(formData.product_id),
        quantity: Number(formData.quantity)
      });
      success("¡Mercadería despachada a tienda con éxito!");
    } catch (err: any) {
      error(err.response?.data?.message || "Error al procesar el envío.");
    }
  };

  if (isLoading) return <p className="p-10 text-center font-bold">Cargando catálogo...</p>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">   
      <div className="max-w-md mx-auto mb-6 text-center">
        <h1 className="text-3xl font-black text-gray-900">Salida de Mercadería</h1>
        <p className="text-gray-500">Mueve los productos terminados a la zona de ventas.</p>
      </div>
      <SendToStoreForm products={products} onSend={handleSend} />
    </div>
  );
}