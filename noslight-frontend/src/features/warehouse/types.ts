// src/features/warehouse/types.ts

export interface StockItem {
  id: number;
  product_variant_id: number;
  warehouse_id: number;
  quantity: number;
  is_raw: number;
  created_at: string;
  updated_at: string;
  product_variant?: {
    id: number;
    product_id: number;
    amperage: string;
    sku: string;
    is_finished: boolean;
    product: {
      id: number;
      name: string;
      base_code: string;
      model: string;
    };
  };
  warehouse?: {
    id: number;
    name: string;
    code: string;
  };
}

export interface DisplayStockItem {
  id: number;
  name: string;
  quantity: number;
  unit?: string;
  amperage?: string;
  is_raw: number;
  sku?: string;
  product_variant_id: number;
  units_per_box?: number;  // ← agregado para cajones (opcional)
}

export type StockList = StockItem[];
export type DisplayStockList = DisplayStockItem[];