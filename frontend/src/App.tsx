import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedLayout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { InventoryPage } from "./pages/Inventory";
import { WorkOrdersPage } from "./pages/WorkOrders";
import { TransfersPage } from "./pages/Transfers";
import { OrdersPage } from "./pages/Orders";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/work-orders" element={<WorkOrdersPage />} />
          <Route path="/transfers" element={<TransfersPage />} />
          <Route path="/orders" element={<OrdersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/inventory" replace />} />
      </Routes>
    </AuthProvider>
  );
}
