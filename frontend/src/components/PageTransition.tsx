import type { ReactNode } from "react";

// Each route renders a fresh component instance on navigation, so a plain CSS
// animation on mount doubles as a page transition with no router-transition library.
export function PageTransition({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
