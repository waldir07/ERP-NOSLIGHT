export type Role = 'ADMIN' | 'WAREHOUSE' | 'STORE';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  // si tu backend devuelve más campos (ej: avatar, permissions), agrégalos aquí
}

export interface AuthResponse {
  user: User;
  token: string;
}