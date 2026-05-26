import api from '@/lib/axios';
import { AuthResponse,User } from '@/types/user';

export const loginUser = async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>('/api/login', credentials); // ← ajusta el endpoint si es diferente
  return data;
};

export const getUser = async (): Promise<User> => {
  const { data } = await api.get<User>('/api/user'); // endpoint para obtener usuario autenticado (si tu backend lo tiene)
  return data;
};