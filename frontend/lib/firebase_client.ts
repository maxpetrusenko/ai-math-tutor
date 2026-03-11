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

let resolvedConfig: FirebaseWebConfig | null | undefined;
let loadingConfigPromise: Promise<FirebaseWebConfig | null> | null = null;

function readPublicFirebaseWebConfig(): FirebaseWebConfig | null {
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (!env) {
    return null;
  }

  const jsonConfig = env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG?.trim();
  if (jsonConfig) {
    try {
      return JSON.parse(jsonConfig) as FirebaseWebConfig;
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

async function fetchRuntimeFirebaseWebConfig(): Promise<FirebaseWebConfig | null> {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return null;
  }

  try {
    const response = await fetch("/api/firebase/config", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      return null;
    }

    return await response.json() as FirebaseWebConfig;
  } catch {
    return null;
  }
}

function getResolvedFirebaseWebConfig(): FirebaseWebConfig | null {
  if (resolvedConfig !== undefined) {
    return resolvedConfig;
  }

  const publicConfig = readPublicFirebaseWebConfig();
  if (publicConfig) {
    resolvedConfig = publicConfig;
    return publicConfig;
  }

  return null;
}

function initializeFirebaseApp(config: FirebaseWebConfig): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(config);
}

export function isFirebaseEnabled() {
  return getResolvedFirebaseWebConfig() !== null;
}

export async function ensureFirebaseApp(): Promise<FirebaseApp | null> {
  const existing = getResolvedFirebaseWebConfig();
  if (existing) {
    return initializeFirebaseApp(existing);
  }

  if (!loadingConfigPromise) {
    loadingConfigPromise = fetchRuntimeFirebaseWebConfig().then((config) => {
      resolvedConfig = config;
      return config;
    });
  }

  const loadedConfig = await loadingConfigPromise;
  loadingConfigPromise = null;
  if (!loadedConfig) {
    return null;
  }

  return initializeFirebaseApp(loadedConfig);
}

export function getFirebaseApp(): FirebaseApp | null {
  const config = getResolvedFirebaseWebConfig();
  if (!config) {
    return null;
  }

  return initializeFirebaseApp(config);
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
