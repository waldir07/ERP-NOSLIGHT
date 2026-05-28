// src/features/admin/hooks/useAdminProducts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';

export interface Product {
  id: number;
  name: string;
  base_code: string;
  model?: string | null;
  brand?: string | null;
  package_size: number;
  is_raw: boolean;
  cost_price: number;
  supplier?: string | null;
  notes?: string | null;
  is_direct_sale: boolean; //<-- Nuevo campo para distinguir productos de venta directa -->
  // --- NUEVOS CAMPOS ---
  raw_product_id?: number | null;
  amperage?: number | null;
  poles?: number | null;

}

/*----probando nueva paginación ----

export const useAdminProducts = () => {
  return useQuery<Product[]>({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const res = await axios.get('/api/products');
      const rawData = res.data.data ?? res.data ?? [];

      // Convertir campos numéricos correctamente
      return rawData.map((product: any) => ({
        ...product,
        package_size: Number(product.package_size),
        cost_price: Number(product.cost_price),
        is_raw: Boolean(product.is_raw),
        is_direct_sale: Boolean(product.is_direct_sale), // <-- Aseguramos que este campo también sea booleano, para mapear correctamente en el frontend
        
      }));
    },
  });
};

*/
// src/features/admin/hooks/useAdminProducts.ts

export const useAdminProducts = (page?: number, search?: string) => {
  return useQuery({
    // IMPORTANTE: Mantenemos el queryKey con una estructura fija para que 
    // React Query no se confunda al cambiar entre estados de búsqueda.
    queryKey: ['admin-products', page, search],
    
    queryFn: async () => {
      const params: any = {};
      
      if (page) {
        params.paginated = true;
        params.page = page;
        params.per_page = 10;
      }
      
      if (search) {
        params.search = search;
      }

      const res = await axios.get('/api/products', { params });
      
      // RETROCOMPATIBILIDAD:
      // Si Laravel paginó, la data real de los productos vendrá en res.data.data
      const isPaginated = res.data && res.data.data && Array.isArray(res.data.data);
      const rawData = isPaginated ? res.data.data : (Array.isArray(res.data) ? res.data : []);

      // RESPETAMOS LA NUBE: Mapeamos los productos exactamente igual que antes
      const mappedProducts = rawData.map((product: any) => ({
        ...product,
        package_size: Number(product.package_size),
        cost_price: Number(product.cost_price),
        is_raw: Boolean(product.is_raw),
        is_direct_sale: Boolean(product.is_direct_sale),
      }));
      

      // Si es paginado, retornamos la estructura de objeto que espera tu nueva grilla
      if (isPaginated) {
        return {
          products: mappedProducts,
          lastPage: res.data.last_page || 1,
          total: res.data.total || mappedProducts.length,
          currentPage: res.data.current_page || 1,
          isPaginated: true
        };
      }

      // Si no es paginado, retornamos solo el array original mapeado
      return mappedProducts;
    },
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => axios.post('/api/products', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & any) => axios.put(`/api/products/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => axios.delete(`/api/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  });
};