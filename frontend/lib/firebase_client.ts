"use client";

import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

type FirebaseWebConfig = {
  apiKey: string;
  appId: string;
  authDomain: string;
  measurementId?: string;
  messagingSenderId: string;
  projectId: string;
  storageBucket: string;
};

const REQUIRED_FIREBASE_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

function readFirebaseWebConfig(): FirebaseWebConfig | null {
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (!env) {
    return null;
  }

  const appHostingConfig = env.FIREBASE_WEBAPP_CONFIG?.trim();
  if (appHostingConfig) {
    try {
      return JSON.parse(appHostingConfig) as FirebaseWebConfig;
    } catch {
      return null;
    }
  }

  for (const key of REQUIRED_FIREBASE_ENV_KEYS) {
    if (!env[key]?.trim()) {
      return null;
    }
  }

  return {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  };
}

export function isFirebaseEnabled() {
  return readFirebaseWebConfig() !== null;
}

export function getFirebaseApp(): FirebaseApp | null {
  const config = readFirebaseWebConfig();
  if (!config) {
    return null;
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(config);
}

export function getFirebaseAuthClient(): Auth | null {
  if (typeof window === "undefined") {
    return null;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  return getAuth(app);
}

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
