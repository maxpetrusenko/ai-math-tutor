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
          const auth = getFirebaseAuthClient();
          if (!auth) {
            return;
          }

          await signInWithPopup(auth, new GoogleAuthProvider());
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
