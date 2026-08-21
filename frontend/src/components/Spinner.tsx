export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="spinner-row">
      <span className="spinner" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}
