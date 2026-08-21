export function Banner({ kind, message }: { kind: "error" | "success"; message: string }) {
  if (!message) return null;
  // Keying on the message forces a remount when it changes, so the entrance
  // animation replays for every new error/success instead of only the first.
  return (
    <div key={message} className={`banner banner-${kind}`}>
      {message}
    </div>
  );
}
