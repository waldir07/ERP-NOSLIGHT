import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

// Listado de usuarios
export const useAdminUsers = () => {
  return useQuery<User[], Error>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await axios.get('/api/users');
      return res.data.data || res.data;
    },
  });
};

// Crear usuario
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string; role: string }) =>
      axios.post('/api/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] }); // refresca la lista automáticamente
    },
  });
};

// Eliminar usuario
export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => axios.delete(`/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] }); // refresca la lista automáticamente
    },
  });

  
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: number; name?: string; email?: string; password?: string; role?: string }) => 
      axios.put(`/api/users/${data.id}`, data),   // ← usamos "axios" porque ya lo tienes importado
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
  });
};