import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedLayout() {
  const { user, loading, logout } = useAuth();

  if (loading) return <div className="page">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">Mini Op ERP</div>
        <nav>
          <NavLink to="/inventory">Inventory</NavLink>
          <NavLink to="/work-orders">Work Orders</NavLink>
          <NavLink to="/transfers">Internal Transfers</NavLink>
          <NavLink to="/orders">Customer Orders</NavLink>
        </nav>
        <div className="user-info">
          <span>
            {user.name} <em>({user.role})</em>
          </span>
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
