import axios from "@/lib/axios";

// Solicitar ajuste
export const createAdjustment = async (data: any) => {
  const response = await axios.post('/api/inventory-adjustments', data);
  return response.data;
};

// Ver pendientes (Admin)
export const getPendingAdjustments = async () => {
  const response = await axios.get('/api/inventory-adjustments/pending');
  return response.data;
};

// Aprobar
export const approveAdjustment = async (id: number) => {
  const response = await axios.post(`/api/inventory-adjustments/${id}/approve`);
  return response.data;
};

// Rechazar
export const rejectAdjustment = async (id: number) => {
  const response = await axios.post(`/api/inventory-adjustments/${id}/reject`);
  return response.data;
};