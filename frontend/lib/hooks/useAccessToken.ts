"use client";

import { useEffect, useState } from "react";
import { getSession } from "next-auth/react";

/**
 * The plain HS256 JWT FastAPI verifies (see lib/api/client.ts's
 * getAuthHeaders), as a raw string — for the handful of places that need
 * it directly rather than as a fetch header. The main case is image URLs
 * handed to <img src>: a browser-native image request can't carry a
 * custom Authorization header, so those URLs append the token as a
 * `?token=` query param instead (backend/services/auth.py's
 * get_current_user accepts either).
 *
 * Returns undefined until the session has loaded; components using this
 * for an <img src> should treat that as "don't render the image src yet"
 * rather than falling back to an unauthenticated URL.
 */
export function useAccessToken(): string | undefined {
  const [token, setToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getSession().then((session) => {
      if (cancelled) return;
      setToken((session as unknown as { accessToken?: string } | null)?.accessToken);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return token;
}
