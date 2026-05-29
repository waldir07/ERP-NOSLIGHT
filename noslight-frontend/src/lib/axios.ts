import axios from 'axios';

const api = axios.create({
  // Ahora sí lee dinámicamente el entorno sin romper nada
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Agrega token automáticamente en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('noslight_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Opcional: manejar 401 (token expirado) → redirigir a login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('noslight_token');
      localStorage.removeItem('noslight_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;