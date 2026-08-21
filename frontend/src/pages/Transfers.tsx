import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { apiRequest, ApiClientError } from "../api/client";
import type { Transfer } from "../api/types";
import { useReferenceData } from "../api/useReferenceData";
import { useAuth } from "../context/AuthContext";
import { Banner } from "../components/Banner";
import { Spinner } from "../components/Spinner";
import { PageTransition } from "../components/PageTransition";
import { TransferIcon } from "../components/Icons";

export function TransfersPage() {
  const { user } = useAuth();
  const { locations, items } = useReferenceData();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canManage = user?.role === "ADMIN" || user?.role === "OPERATIONS";

  const [form, setForm] = useState({
    sourceLocationId: "",
    destinationLocationId: "",
    itemId: "",
    batch: "",
    quantity: "",
  });

  async function refresh() {
    setLoading(true);
    try {
      setTransfers(await apiRequest<Transfer[]>("/transfers"));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load transfers");
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
      await apiRequest("/transfers", {
        method: "POST",
        body: {
          sourceLocationId: form.sourceLocationId,
          destinationLocationId: form.destinationLocationId,
          itemId: form.itemId,
          batch: form.batch,
          quantity: Number(form.quantity),
        },
      });
      setSuccess("Transfer requested");
      setForm({ sourceLocationId: "", destinationLocationId: "", itemId: "", batch: "", quantity: "" });
      refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create transfer");
    }
  }

  async function handleAction(id: string, action: "dispatch" | "receive") {
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/transfers/${id}/${action}`, { method: "POST" });
      setSuccess(action === "dispatch" ? "Transfer dispatched" : "Transfer received");
      refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Failed to ${action} transfer`);
    }
  }

  return (
    <PageTransition>
      <h2>Internal Transfers</h2>
      <Banner kind="error" message={error} />
      <Banner kind="success" message={success} />

      {canManage && (
        <form className="inline-form" onSubmit={handleCreate}>
          <h3>Request transfer</h3>
          <div className="form-row">
            <select
              value={form.sourceLocationId}
              onChange={(e) => setForm({ ...form, sourceLocationId: e.target.value })}
              required
            >
              <option value="">Source…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select
              value={form.destinationLocationId}
              onChange={(e) => setForm({ ...form, destinationLocationId: e.target.value })}
              required
            >
              <option value="">Destination…</option>
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
              placeholder="Batch"
              value={form.batch}
              onChange={(e) => setForm({ ...form, batch: e.target.value })}
              required
            />
            <input
              placeholder="Quantity"
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
            <button type="submit">Request</button>
          </div>
        </form>
      )}

      {loading ? (
        <Spinner label="Loading transfers" />
      ) : transfers.length === 0 ? (
        <div className="empty-state">
          <TransferIcon width={28} height={28} />
          <p>No internal transfers yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Item</th>
                <th>Batch</th>
                <th>Qty</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t, i) => (
                <tr key={t.id} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                  <td>{t.code}</td>
                  <td>{t.sourceLocation.name}</td>
                  <td>{t.destinationLocation.name}</td>
                  <td>{t.item.name}</td>
                  <td>{t.batch}</td>
                  <td>{t.quantity}</td>
                  <td>
                    <span className={`status-badge status-${t.status.toLowerCase()}`}>
                      {t.status}
                    </span>
                  </td>
                  <td>
                    {canManage && t.status === "REQUESTED" && (
                      <button onClick={() => handleAction(t.id, "dispatch")}>Dispatch</button>
                    )}
                    {canManage && t.status === "DISPATCHED" && (
                      <button onClick={() => handleAction(t.id, "receive")}>Receive</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageTransition>
  );
}
