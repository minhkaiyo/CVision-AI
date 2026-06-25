"use client";

/**
 * useAuthGuard — Redirects to /login if the user is not authenticated.
 *
 * Returns { user, loading } so the caller can show a spinner while
 * Firebase initializes. Uses onAuthStateChanged exclusively — Firebase
 * will emit null initially while restoring the session, then emit the
 * real user once the token is read from localStorage.
 *
 * IMPORTANT: We must NOT call auth.currentUser synchronously on mount
 * because Firebase needs a short time to restore the persisted session.
 * Calling currentUser before the SDK is ready always returns null and
 * causes an immediate redirect to /login (the "instant logout" bug).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAppAuthStateChange, type AppUser } from "./auth";

export function useAuthGuard() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Track whether the first auth state emission has arrived
  const initializedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAppAuthStateChange((appUser) => {
      setUser(appUser);
      setLoading(false);
      initializedRef.current = true;

      if (!appUser) {
        router.replace("/login");
      }
    });

    return () => {
      unsubscribe();
    };
  }, [router]);

  return { user, loading };
}
