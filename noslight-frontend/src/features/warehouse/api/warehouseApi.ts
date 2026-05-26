import api from '@/lib/axios';

// Stock (raw y finished usan el mismo endpoint /stocks)
export const getRawStock = async () => {
  const res = await api.get('/api/stocks');
  console.log('[DEBUG] Raw stock response:', res.data);
  return res.data.data || res.data; // ajusta si tu controller devuelve { data: [...] }
};

export const getFinishedStock = async () => {
  const res = await api.get('/api/stocks');
  console.log('[DEBUG] Finished stock response:', res.data);
  return res.data.data || res.data;
};

// Low stock – paths exactos de tu Laravel
export const getLowStockRaw = async (threshold = 50) => {
  const res = await api.get('/api/alerts/low-stock-raw', { params: { threshold } });
  console.log('[DEBUG] Low stock raw:', res.data);
  return res.data;
};

export const getLowStockFinished = async (threshold = 20) => {
  const res = await api.get('/api/alerts/low-stock-finished', { params: { threshold } });
  console.log('[DEBUG] Low stock finished:', res.data);
  return res.data;
};

// Transform – ruta exacta
export const performTransform = async (data: {
  raw_product_id: number;
  finished_product_id: number;
  quantity: number;
  notes?: string;
}) => {
  const res = await api.post('/api/transformations', data);
  console.log('[DEBUG] Transform response:', res.data);
  return res.data;
};

// Movimientos
export const getStockMovements = async () => {
  const res = await api.get('/api/stock-movements');
  console.log('[DEBUG] Movements response:', res.data);
  return res.data.data || res.data;
};