import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Logo } from "./Logo";
import { Spinner } from "./Spinner";
import { InventoryIcon, LogoutIcon, OrderIcon, TransferIcon, WorkOrderIcon } from "./Icons";

const NAV_ITEMS = [
  { to: "/inventory", label: "Inventory", icon: InventoryIcon },
  { to: "/work-orders", label: "Work Orders", icon: WorkOrderIcon },
  { to: "/transfers", label: "Internal Transfers", icon: TransferIcon },
  { to: "/orders", label: "Customer Orders", icon: OrderIcon },
];

export function ProtectedLayout() {
  const { user, loading, logout } = useAuth();

  if (loading)
    return (
      <div className="page">
        <Spinner />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <Logo size={30} />
          <span>Mini Op ERP</span>
        </div>
        <nav>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="nav-link">
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="user-info">
          <span className="avatar" aria-hidden="true">
            {user.name.charAt(0)}
          </span>
          <span className="user-meta">
            {user.name}
            <em>{user.role}</em>
          </span>
          <button className="ghost-button" onClick={logout}>
            <LogoutIcon width={16} height={16} />
            Log out
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
