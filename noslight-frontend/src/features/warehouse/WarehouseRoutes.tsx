// src/features/warehouse/WarehouseRoutes.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import WarehouseDashboardContent from './components/WarehouseDashboardContent';
import StockList from './components/StockList';
import TransformForm from './components/TransformForm';
import TransferHistoryPage from './components/TransferHistoryPage';
import MovementsList from './components/MovementsList';
import LowStockAlerts from './components/LowStockAlerts';

export default function WarehouseRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WarehouseDashboardContent />} />
      <Route path="stock/raw" element={<StockList type="raw" />} />
      <Route path="stock/finished" element={<StockList type="finished" />} />
      <Route path="transform" element={<TransformForm />} />
      <Route path="transfers" element={<TransferHistoryPage />} />
      <Route path="*" element={<Navigate to="/warehouse" replace />} />
    </Routes>
  );
}