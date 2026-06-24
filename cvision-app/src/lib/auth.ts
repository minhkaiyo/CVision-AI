// auth.ts — CVision AI Auth Layer (Firebase)
import type { User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { getFirebaseAuth, getFirestoreDb, getGoogleProvider } from "./firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppUser = User;

export type ProfileRecord = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  school?: string | null;
  major?: string | null;
  plan?: string | null;
  role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<AppUser | null> {
  return getFirebaseAuth().currentUser;
}

export async function getAccessToken(): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export function onAppAuthStateChange(callback: (user: AppUser | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const data = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signUpWithEmail(email: string, password: string, fullName: string) {
  try {
    const data = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    if (data.user) {
      await updateProfile(data.user, { displayName: fullName });
    }
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Initiates Google Sign-In via redirect (avoids COOP popup issues in Next.js).
 * After redirect returns to the app, call getGoogleRedirectResult() in a useEffect.
 */
export async function signInWithGoogle() {
  try {
    await signInWithRedirect(getFirebaseAuth(), getGoogleProvider());
    return { data: null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Call this once on app load to resolve the pending Google redirect. */
export async function getGoogleRedirectResult() {
  try {
    const result = await getRedirectResult(getFirebaseAuth());
    return { data: result, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signOutAppUser() {
  try {
    await signOut(getFirebaseAuth());
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function sendResetPasswordEmail(email: string) {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function updateCurrentUserPassword(password: string) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("User not authenticated");
  await updatePassword(user, password);
}

// ─── Profile helpers (Firestore) ──────────────────────────────────────────────

export async function getProfile(userId: string): Promise<ProfileRecord | null> {
  const snapshot = await getDoc(doc(getFirestoreDb(), "profiles", userId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as Omit<ProfileRecord, "id">) };
}

export async function upsertProfile(userId: string, payload: Partial<ProfileRecord>) {
  await setDoc(
    doc(getFirestoreDb(), "profiles", userId),
    {
      id: userId,
      ...payload,
      updated_at: serverTimestamp(),
      created_at: payload.created_at ?? serverTimestamp(),
    },
    { merge: true }
  );
}
