"use client";

import { getFirestore, type Firestore } from "firebase/firestore";

import { getFirebaseApp } from "./firebase_client";

export function getFirebaseFirestore(): Firestore | null {
  if (typeof window === "undefined") {
    return null;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  return getFirestore(app);
}
