import { Route, Routes } from "react-router-dom";
import StoreLayout from "./components/StoreLayout";
import StoreDashboard from "./components/StoreDashboard";
import ReceiveInventoryPage from "./components/ReceiveInventoryPage";
import StoreStockList from "./components/StoreStockList";
import NewSalePage from "./components/NewSalePage";
import CreditsPage from "./components/CreditsPage";
import { SalesHistoryPage } from "./components/SalesHistoryPage";
import ExpensesPage from "./components/ExpensesPage";   // ← Este import debe existir
import CashClosure from "./components/CashClosure";





export default function StoreRoutes() {
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<StoreDashboard />} />
        <Route path="receive" element={<ReceiveInventoryPage />} />
        <Route path="stock" element={<StoreStockList />} />
        <Route path="pos" element={<NewSalePage />} />
        <Route path="credits" element={<CreditsPage />} />
        <Route path="historial" element={<SalesHistoryPage />} />
        <Route path="gastos" element={<ExpensesPage />} />
        <Route path="cash-closures" element={<CashClosure />} />
      </Route>
    </Routes>
  );
}