import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiClientError } from "../api/client";
import { Banner } from "../components/Banner";
import { Logo } from "../components/Logo";

const QUICK_ACCOUNTS = [
  { label: "Admin", email: "admin@erp.test" },
  { label: "Operations", email: "ops@erp.test" },
  { label: "Sales", email: "sales@erp.test" },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@erp.test");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/inventory" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-blob login-blob-a" aria-hidden="true" />
      <div className="login-blob login-blob-b" aria-hidden="true" />

      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <Logo size={40} />
          <div>
            <h1>Mini Op ERP</h1>
            <p className="subtitle">Sign in to continue</p>
          </div>
        </div>

        <Banner kind="error" message={error} />

        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        <button type="submit" disabled={submitting} className="submit-button">
          {submitting ? <span className="spinner spinner-inline" aria-hidden="true" /> : null}
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <div className="quick-accounts">
          <span className="quick-accounts-label">Quick fill</span>
          <div className="quick-accounts-row">
            {QUICK_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="chip-button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword("password123");
                }}
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
