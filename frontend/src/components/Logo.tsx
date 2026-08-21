export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="logo-mark"
      role="img"
      aria-label="Mini Op ERP"
    >
      <defs>
        <linearGradient id="logo-badge" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#logo-badge)" />
      <polygon points="12,4 18.5,7.6 12,11.2 5.5,7.6" fill="#fff" opacity="0.95" />
      <polygon points="5.5,7.6 12,11.2 12,18.4 5.5,14.8" fill="#fff" opacity="0.75" />
      <polygon points="18.5,7.6 12,11.2 12,18.4 18.5,14.8" fill="#fff" opacity="0.6" />
    </svg>
  );
}
