import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { apiRequest, ApiClientError } from "../api/client";
import type { InventoryRecord } from "../api/types";
import { useReferenceData } from "../api/useReferenceData";
import { useAuth } from "../context/AuthContext";
import { Banner } from "../components/Banner";
import { Spinner } from "../components/Spinner";
import { PageTransition } from "../components/PageTransition";
import { InventoryIcon } from "../components/Icons";

export function InventoryPage() {
  const { user } = useAuth();
  const { locations, items } = useReferenceData();
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canManage = user?.role === "ADMIN" || user?.role === "OPERATIONS";

  const [form, setForm] = useState({ itemId: "", locationId: "", batch: "", physicalQuantity: "" });
  const [adjustQty, setAdjustQty] = useState<Record<string, string>>({});

  async function refresh() {
    setLoading(true);
    try {
      setRecords(await apiRequest<InventoryRecord[]>("/inventory"));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load inventory");
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
      await apiRequest("/inventory", {
        method: "POST",
        body: {
          itemId: form.itemId,
          locationId: form.locationId,
          batch: form.batch,
          physicalQuantity: Number(form.physicalQuantity),
          idempotencyKey: crypto.randomUUID(),
        },
      });
      setSuccess("Inventory record created");
      setForm({ itemId: "", locationId: "", batch: "", physicalQuantity: "" });
      refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create inventory record");
    }
  }

  async function handleAdjust(id: string) {
    const raw = adjustQty[id];
    const delta = Number(raw);
    if (!raw || Number.isNaN(delta) || delta === 0) {
      setError("Enter a non-zero adjustment amount");
      return;
    }
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/inventory/${id}/adjust`, {
        method: "POST",
        body: { delta, idempotencyKey: crypto.randomUUID() },
      });
      setSuccess("Inventory adjusted");
      setAdjustQty((prev) => ({ ...prev, [id]: "" }));
      refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Adjustment failed");
    }
  }

  return (
    <PageTransition>
      <h2>Inventory</h2>
      <Banner kind="error" message={error} />
      <Banner kind="success" message={success} />

      {canManage && (
        <form className="inline-form" onSubmit={handleCreate}>
          <h3>Add inventory record</h3>
          <div className="form-row">
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
            <input
              placeholder="Batch"
              value={form.batch}
              onChange={(e) => setForm({ ...form, batch: e.target.value })}
              required
            />
            <input
              placeholder="Quantity"
              type="number"
              min={1}
              value={form.physicalQuantity}
              onChange={(e) => setForm({ ...form, physicalQuantity: e.target.value })}
              required
            />
            <button type="submit">Add</button>
          </div>
        </form>
      )}

      {loading ? (
        <Spinner label="Loading inventory" />
      ) : records.length === 0 ? (
        <div className="empty-state">
          <InventoryIcon width={28} height={28} />
          <p>No inventory records yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Location</th>
                <th>Batch</th>
                <th>Physical</th>
                <th>Reserved</th>
                <th>Available</th>
                {canManage && <th>Adjust</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                  <td>{r.item.name} ({r.item.sku})</td>
                  <td>{r.item.category?.name}</td>
                  <td>{r.location.name}</td>
                  <td>{r.batch}</td>
                  <td>{r.physicalQuantity}</td>
                  <td>{r.reservedQuantity}</td>
                  <td className="cell-strong">{r.availableQuantity}</td>
                  {canManage && (
                    <td>
                      <div className="adjust-cell">
                        <input
                          type="number"
                          placeholder="+/-"
                          value={adjustQty[r.id] ?? ""}
                          onChange={(e) =>
                            setAdjustQty((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                        />
                        <button onClick={() => handleAdjust(r.id)}>Apply</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageTransition>
  );
}
