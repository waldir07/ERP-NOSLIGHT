// src/features/admin/components/AdminProducts.tsx
import { useState } from "react";
import { 
  useAdminProducts, 
  useCreateProduct, 
  useUpdateProduct, 
  useDeleteProduct,
  type Product 
} from "../hooks/useAdminProducts";
import AdminProductForm from "./AdminProductForm";
import AdminRawTransformationsModal from "./AdminRawTransformationsModal"; // ← Nuevo
import { useToast } from "@/components/ToastProvider";

export default function AdminProducts() {
  const { success, error: toastError } = useToast();

  const [view, setView] = useState<"list" | "form">("list");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Estado para el modal de transformaciones
  const [selectedRawProduct, setSelectedRawProduct] = useState<Product | null>(null);

  const { data: products = [], isLoading, error } = useAdminProducts();
  
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  // Buscador inteligente
  // Buscador inteligente (ACTUALIZADO CON MARCA)
  const filteredProducts = products.filter((product) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;

    const sku = product.is_raw ? `M-${product.base_code}`.toLowerCase() : product.base_code.toLowerCase();
    const name = product.name.toLowerCase();
    const baseCode = product.base_code.toLowerCase();
    const brand = (product.brand || "").toLowerCase(); // <-- Leemos la marca

    if (term.startsWith("m-")) {
      return product.is_raw && sku.includes(term);
    }

    return name.includes(term) || baseCode.includes(term) || brand.includes(term); // <-- Buscamos por marca
  });

  const handleCreateClick = () => {
    setEditingProduct(null);
    setView("form");
  };

  const handleBackToList = () => {
    setView("list");
    setEditingProduct(null);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setView("form");
  };

  const handleDelete = (id: number, name: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${name}"?\nEsta acción no se puede deshacer.`)) return;

    deleteMutation.mutate(id, {
      onSuccess: () => success(`Producto "${name}" eliminado correctamente`),
      onError: (err: any) => toastError(`No se pudo eliminar: ${err?.response?.data?.message || "Error desconocido"}`),
    });
  };

  const handleSave = (formData: any) => {
    const payload = {
      name: formData.name,
      base_code: formData.base_code,
      model: formData.model || null,
      brand: formData.brand || null, // <-- AGREGAMOS MARCA AL PAYLOAD
      package_size: formData.package_size,
      is_raw: formData.is_raw,
      is_direct_sale: formData.is_direct_sale,
      cost_price: formData.cost_price,
      supplier: formData.supplier || null,
      notes: formData.notes || null,
      amperage: formData.amperage || null,
      poles: formData.poles || null,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, ...payload }, {
        onSuccess: () => { success("Producto actualizado correctamente"); handleBackToList(); },
        onError: (err: any) => toastError(`Error al actualizar: ${err?.response?.data?.message || "Intenta de nuevo"}`),
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { success("Producto creado con éxito 🎉"); handleBackToList(); },
        onError: (err: any) => toastError(`Error al crear: ${err?.response?.data?.message || "Intenta de nuevo"}`),
      });
    }
  };

  if (isLoading) return <div className="text-center py-12 text-gray-600">Cargando productos...</div>;
  if (error) return <div className="text-red-600 text-center py-12">Error al cargar los productos</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Gestión de Productos</h2>

        {view === "list" && (
          <button
            onClick={handleCreateClick}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition font-medium"
          >
            ➕ Crear Nuevo Producto
          </button>
        )}
      </div>

      {/* Buscador */}
      {view === "list" && (
        <div className="mb-6">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Buscar por nombre o código (usa M- para filtrar solo Raw)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-2xl px-5 py-3 pl-12 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="text-sm text-gray-500 mt-2">
              Mostrando {filteredProducts.length} de {products.length} productos
            </p>
          )}
        </div>
      )}

      {/* Lista de Productos */}
      {view === "list" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredProducts.length === 0 && searchTerm ? (
            <div className="text-center py-20 text-gray-500">
              <p>No se encontraron productos con esa búsqueda</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase">Nombre</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase">Código (SKU)</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase">Tipo</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase">Paquete</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase">Precio Base</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => {
                    const sku = product.is_raw ? `M-${product.base_code}` : product.base_code;
                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.id}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{product.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sku}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {product.is_raw ? "Base (Raw)" : "Terminado"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {product.package_size} und
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          S/ {Number(product.cost_price || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-blue-600 hover:text-blue-800 mr-4"
                          >
                            Editar
                          </button>

                          {/* BOTÓN DE TRANSFORMACIONES - Solo para Raw */}
                          {product.is_raw && (
                            <button
                              onClick={() => setSelectedRawProduct(product)}
                              className="text-purple-600 hover:text-purple-800 mr-4 font-medium"
                            >
                              ⚙️ Transformaciones
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(product.id, product.name)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Formulario de Crear/Editar Producto */}
      {view === "form" && (
        <AdminProductForm
          initialData={editingProduct}
          onSave={handleSave}
          onCancel={handleBackToList}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Modal de Configuración de Transformaciones */}
      {selectedRawProduct && (
        <AdminRawTransformationsModal
          rawProduct={selectedRawProduct}
          onClose={() => setSelectedRawProduct(null)}
        />
      )}
    </div>
  );
}