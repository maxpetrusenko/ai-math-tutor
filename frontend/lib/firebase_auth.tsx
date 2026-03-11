"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { getFirebaseAuthClient, isFirebaseEnabled } from "./firebase_client";

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
  const firebaseEnabled = isFirebaseEnabled();

  useEffect(() => {
    const auth = getFirebaseAuthClient();
    if (!auth) {
      setAuthReady(true);
      setUser(null);
      return;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
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
