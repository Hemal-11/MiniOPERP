export function Banner({ kind, message }: { kind: "error" | "success"; message: string }) {
  if (!message) return null;
  return <div className={`banner banner-${kind}`}>{message}</div>;
}
