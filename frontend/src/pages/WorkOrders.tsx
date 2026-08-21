import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { apiRequest, ApiClientError } from "../api/client";
import type { WorkOrder, WorkOrderStatus } from "../api/types";
import { useReferenceData, useUsers } from "../api/useReferenceData";
import { useAuth } from "../context/AuthContext";
import { Banner } from "../components/Banner";

const NEXT_STATUS: Partial<Record<WorkOrderStatus, WorkOrderStatus>> = {
  ASSIGNED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
};

export function WorkOrdersPage() {
  const { user } = useAuth();
  const { locations, items } = useReferenceData();
  const users = useUsers(user?.role === "ADMIN");
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    locationId: "",
    itemId: "",
    requiredQuantity: "",
    assignedUserId: "",
  });

  async function refresh() {
    setLoading(true);
    try {
      setWorkOrders(await apiRequest<WorkOrder[]>("/work-orders"));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load work orders");
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
      const wo = await apiRequest<WorkOrder>("/work-orders", {
        method: "POST",
        body: {
          locationId: form.locationId,
          itemId: form.itemId,
          requiredQuantity: Number(form.requiredQuantity),
          assignedUserId: form.assignedUserId,
        },
      });
      setSuccess(
        wo.shortageQuantity > 0
          ? `Work order created — shortage of ${wo.shortageQuantity} at this location`
          : "Work order created — sufficient stock available"
      );
      setForm({ locationId: "", itemId: "", requiredQuantity: "", assignedUserId: "" });
      refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create work order");
    }
  }

  async function advanceStatus(wo: WorkOrder) {
    const next = NEXT_STATUS[wo.status];
    if (!next) return;
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/work-orders/${wo.id}/status`, { method: "PATCH", body: { status: next } });
      refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update status");
    }
  }

  return (
    <div>
      <h2>Work Orders</h2>
      <Banner kind="error" message={error} />
      <Banner kind="success" message={success} />

      {user?.role === "ADMIN" && (
        <form className="inline-form" onSubmit={handleCreate}>
          <h3>Create work order</h3>
          <div className="form-row">
            <select
              value={form.locationId}
              onChange={(e) => setForm({ ...form, locationId: e.target.value })}
              required
            >
              <option value="">Location…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select
              value={form.itemId}
              onChange={(e) => setForm({ ...form, itemId: e.target.value })}
              required
            >
              <option value="">Item…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.sku})
                </option>
              ))}
            </select>
            <input
              placeholder="Required qty"
              type="number"
              min={1}
              value={form.requiredQuantity}
              onChange={(e) => setForm({ ...form, requiredQuantity: e.target.value })}
              required
            />
            <select
              value={form.assignedUserId}
              onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}
              required
            >
              <option value="">Assign to…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
            <button type="submit">Create</button>
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
              <th>Location</th>
              <th>Item</th>
              <th>Required</th>
              <th>Shortage</th>
              <th>Assigned</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {workOrders.map((wo) => (
              <tr key={wo.id}>
                <td>{wo.code}</td>
                <td>{wo.location.name}</td>
                <td>{wo.item.name}</td>
                <td>{wo.requiredQuantity}</td>
                <td className={wo.shortageQuantity > 0 ? "text-warning" : ""}>
                  {wo.shortageQuantity}
                </td>
                <td>{wo.assignedUser.name}</td>
                <td>
                  <span className={`status-badge status-${wo.status.toLowerCase()}`}>
                    {wo.status}
                  </span>
                </td>
                <td>
                  {(user?.role === "ADMIN" || user?.id === wo.assignedUserId) &&
                    NEXT_STATUS[wo.status] && (
                      <button onClick={() => advanceStatus(wo)}>
                        Move to {NEXT_STATUS[wo.status]}
                      </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
