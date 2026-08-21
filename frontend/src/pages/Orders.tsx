import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { apiRequest, ApiClientError } from "../api/client";
import type { CustomerOrder, InventoryRecord } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { Banner } from "../components/Banner";

export function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canCreate = user?.role === "SALES" || user?.role === "ADMIN";

  const [form, setForm] = useState({ customerName: "", inventoryRecordId: "", quantity: "" });

  async function refresh() {
    setLoading(true);
    try {
      const [ordersData, inventoryData] = await Promise.all([
        apiRequest<CustomerOrder[]>("/orders"),
        apiRequest<InventoryRecord[]>("/inventory"),
      ]);
      setOrders(ordersData);
      setInventory(inventoryData);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await apiRequest("/orders", {
        method: "POST",
        body: {
          customerName: form.customerName,
          inventoryRecordId: form.inventoryRecordId,
          quantity: Number(form.quantity),
        },
      });
      setSuccess("Order created and stock reserved");
      setForm({ customerName: "", inventoryRecordId: "", quantity: "" });
      refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create order");
    }
  }

  async function handleCancel(id: string) {
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/orders/${id}/cancel`, { method: "POST" });
      setSuccess("Order cancelled and reservation released");
      refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to cancel order");
    }
  }

  return (
    <div>
      <h2>Customer Orders</h2>
      <Banner kind="error" message={error} />
      <Banner kind="success" message={success} />

      {canCreate && (
        <form className="inline-form" onSubmit={handleCreate}>
          <h3>Create order &amp; reserve stock</h3>
          <div className="form-row">
            <input
              placeholder="Customer name"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              required
            />
            <select
              value={form.inventoryRecordId}
              onChange={(e) => setForm({ ...form, inventoryRecordId: e.target.value })}
              required
            >
              <option value="">Item / location / batch…</option>
              {inventory.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.item.name} @ {r.location.name} ({r.batch}) — available {r.availableQuantity}
                </option>
              ))}
            </select>
            <input
              placeholder="Quantity"
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
            <button type="submit">Reserve</button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Customer</th>
              <th>Sales User</th>
              <th>Item</th>
              <th>Location / Batch</th>
              <th>Qty</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) =>
              o.orderLines.map((line) => (
                <tr key={line.id}>
                  <td>{o.code}</td>
                  <td>{o.customerName}</td>
                  <td>{o.salesUser.name}</td>
                  <td>{line.inventoryRecord.item.name}</td>
                  <td>
                    {line.inventoryRecord.location.name} / {line.inventoryRecord.batch}
                  </td>
                  <td>{line.quantity}</td>
                  <td>
                    <span className={`status-badge status-${o.status.toLowerCase()}`}>
                      {o.status}
                    </span>
                  </td>
                  <td>
                    {canCreate && o.status === "OPEN" && (
                      <button onClick={() => handleCancel(o.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
