// src/features/admin/components/AdminProductsList.tsx
import { Product } from '../hooks/useAdminProducts';

interface Props {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: number, name: string) => void;
}

export default function AdminProductsList({ products, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Nombre</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Marca</th> {/* NUEVA COLUMNA */}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Código</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tipo</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Paquete</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Precio Base</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {products.map((product) => (
            <tr key={product.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.id}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{product.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">{product.brand || '—'}</td> {/* NUEVO DATO */}
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {product.is_raw ? `M-${product.base_code}` : product.base_code}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {product.is_raw ? 'Raw (Base)' : 'Terminado'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{product.package_size}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">S/ {Number(product.cost_price).toFixed(2)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  onClick={() => onEdit(product)}
                  className="text-blue-600 hover:text-blue-900 mr-4"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDelete(product.id, product.name)}
                  className="text-red-600 hover:text-red-900"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {products.length === 0 && (
        <p className="text-center text-gray-500 py-10">No hay productos registrados aún.</p>
      )}
    </div>
  );
}