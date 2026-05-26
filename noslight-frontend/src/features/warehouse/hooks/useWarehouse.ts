// src/features/warehouse/hooks/useWarehouse.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRawStock,
  getFinishedStock,        // ← Asegúrate que esta función exista
  getLowStockRaw,
  getLowStockFinished,
  performTransform,
  getStockMovements,
} from '../api/warehouseApi';

export const useRawStock = () => {
  return useQuery({
    queryKey: ['rawStock'],
    queryFn: getRawStock,
  });
};

export const useFinishedStock = () => {
  return useQuery({
    queryKey: ['finishedStock'],
    queryFn: getFinishedStock,   // ← Corregido
  });
};

export const useLowStockRaw = (threshold = 50) => {
  return useQuery({
    queryKey: ['lowStockRaw', threshold],
    queryFn: () => getLowStockRaw(threshold),
  });
};

export const useLowStockFinished = (threshold = 20) => {
  return useQuery({
    queryKey: ['lowStockFinished', threshold],
    queryFn: () => getLowStockFinished(threshold),
  });
};

export const useStockMovements = () => {
  return useQuery({
    queryKey: ['stockMovements'],
    queryFn: getStockMovements,
  });
};