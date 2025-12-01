import { Route, Routes, Navigate } from 'react-router-dom';
import React from 'react';
import { useAuth } from './core/auth';
import LoginPage from './pages/LoginPage';
import HomeLayout from './pages/HomeLayout';
import PosPage from './pages/PosPage';
import OrdersPage from './pages/OrdersPage';
import SettingsPage from './pages/SettingsPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import UsersPage from './pages/UsersPage';
import ReportsPage from './pages/ReportsPage';
import ModifiersPage from './pages/ModifiersPage';
import KitchenPage from './pages/KitchenPage';
import CustomerMenuPage from './pages/CustomerMenuPage';
import TableQRPage from './pages/TableQRPage';

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/customer/menu" element={<CustomerMenuPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <HomeLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/pos" replace />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/kitchen" element={<KitchenPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/modifiers" element={<AdminRoute><ModifiersPage /></AdminRoute>} />
        <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/tables-qr" element={<TableQRPage />} />
      </Route>
    </Routes>
  );
}