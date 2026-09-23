"use client";

import { SessionProvider } from "next-auth/react";

// useSession() (used in AppShell for the sign-out control, and available
// to any other client component going forward) only works inside this
// provider — wraps the whole app from the root layout.
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
