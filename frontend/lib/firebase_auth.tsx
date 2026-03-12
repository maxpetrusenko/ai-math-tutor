"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { ensureFirebaseApp, getFirebaseAuthClient, isFirebaseEnabled } from "./firebase_client";

export const FIREBASE_AUTH_NOT_CONFIGURED_MESSAGE =
  "Firebase auth is not configured on this dev server. Set FIREBASE_WEBAPP_CONFIG in .env.local and restart bash scripts/dev.sh.";

function getBrowserHostname() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.location.hostname || null;
}

export function describeFirebaseAuthError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? error.code : null;
  if (code === "auth/unauthorized-domain") {
    const hostname = getBrowserHostname() ?? "this host";
    return `This host is not authorized for Firebase Google sign-in. Add \`${hostname}\` to Firebase Console -> Authentication -> Settings -> Authorized domains.`;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Google sign-in failed.";
}

type FirebaseAuthContextValue = {
  authReady: boolean;
  firebaseEnabled: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  user: User | null;
};

const FirebaseAuthContext = createContext<FirebaseAuthContextValue>({
  authReady: true,
  firebaseEnabled: false,
  async signInWithGoogle() {},
  async signOutUser() {},
  user: null,
});

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseEnabled, setFirebaseEnabled] = useState(isFirebaseEnabled());

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const hydrateAuth = async () => {
      const app = await ensureFirebaseApp();
      if (cancelled) {
        return;
      }

      if (!app) {
        setFirebaseEnabled(false);
        setAuthReady(true);
        setUser(null);
        return;
      }

      const auth = getFirebaseAuthClient();
      if (!auth) {
        setFirebaseEnabled(false);
        setAuthReady(true);
        setUser(null);
        return;
      }

      setFirebaseEnabled(true);
      unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        setAuthReady(true);
      });
    };

    void hydrateAuth();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return (
    <FirebaseAuthContext.Provider
      value={{
        authReady,
        firebaseEnabled,
        async signInWithGoogle() {
          await ensureFirebaseApp();
          const auth = getFirebaseAuthClient();
          if (!auth) {
            throw new Error(FIREBASE_AUTH_NOT_CONFIGURED_MESSAGE);
          }

          try {
            await signInWithPopup(auth, new GoogleAuthProvider());
          } catch (error) {
            throw new Error(describeFirebaseAuthError(error));
          }
        },
        async signOutUser() {
          const auth = getFirebaseAuthClient();
          if (!auth) {
            return;
          }

          await signOut(auth);
        },
        user,
      }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  return useContext(FirebaseAuthContext);
}

export function getCurrentFirebaseUser() {
  return getFirebaseAuthClient()?.currentUser ?? null;
}

export async function getCurrentFirebaseIdToken() {
  return (await getCurrentFirebaseUser()?.getIdToken()) ?? null;
}
