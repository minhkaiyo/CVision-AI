"use client";

/**
 * useAdminGuard — Allows access only if the user has role="admin" in Firestore.
 *
 * Flow:
 * 1. Wait for Firebase auth to restore session (same pattern as useAuthGuard)
 * 2. If not authenticated → redirect /login
 * 3. If authenticated but role != "admin" → redirect /dashboard (403)
 * 4. If admin → allow render
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProfile, onAppAuthStateChange, type AppUser } from "./auth";

type AdminGuardState = "loading" | "authorized" | "unauthorized";

export function useAdminGuard() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [state, setState] = useState<AdminGuardState>("loading");

  useEffect(() => {
    const unsubscribe = onAppAuthStateChange(async (appUser) => {
      if (!appUser) {
        // Not logged in → go to admin login
        setState("unauthorized");
        router.replace("/admin/login");
        return;
      }

      setUser(appUser);

      try {
        const profile = await getProfile(appUser.uid);
        if (profile?.role === "admin") {
          setState("authorized");
        } else {
          // Logged in but not admin → redirect to admin login with message
          setState("unauthorized");
          router.replace("/admin/login");
        }
      } catch {
        // On Firestore error, fail closed (deny access)
        setState("unauthorized");
        router.replace("/admin/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return {
    user,
    loading: state === "loading",
    authorized: state === "authorized",
  };
}
