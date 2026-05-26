import { useAdminProducts } from '../../admin/hooks/useAdminProducts';
import AdjustmentForm from '../components/AdjustmentForm';
import { createAdjustment } from '../api/inventoryApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useToast } from '@/components/ToastProvider';

export default function InventoryAdjustmentPage() {
  const { user } = useAuth();
  const { data: products = [], isLoading } = useAdminProducts();
  const { success, error: toastError } = useToast();

  const handleSave = async (formData: any) => {
    try {
      const payload = {
        product_id: Number(formData.product_id),
        warehouse_id: Number(formData.warehouse_id),
        // Si es decremento, enviamos el número en negativo
        quantity: formData.type === 'DECREMENT' ? -Number(formData.quantity) : Number(formData.quantity),
        reason: formData.reason,
        notes: formData.notes
      };

      await createAdjustment(payload);
      success("Solicitud enviada correctamente. Esperando aprobación del Admin.");
    } catch (err: any) {
      toastError(err.response?.data?.message || "Error al enviar la solicitud.");
    }
  };

  if (isLoading) return <div className="p-20 text-center font-bold text-gray-400">Cargando catálogo de productos...</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-xl mx-auto mb-8 text-center">
        <h1 className="text-3xl font-black text-gray-900">Control de Merma y Ajustes</h1>
        <p className="text-gray-500 mt-2">Cualquier cambio manual de stock requiere revisión del Administrador.</p>
      </div>

      <AdjustmentForm 
        products={products} 
        onSave={handleSave} 
        userRole={user?.role || 'WAREHOUSE'} 
      />
    </div>
  );
}