"use client";

import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { readFirebaseWebConfigFromEnv, type FirebaseWebConfig } from "./firebase_config";

let resolvedConfig: FirebaseWebConfig | null | undefined;
let loadingConfigPromise: Promise<FirebaseWebConfig | null> | null = null;

function readPublicFirebaseWebConfig(): FirebaseWebConfig | null {
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (!env) {
    return null;
  }

  return readFirebaseWebConfigFromEnv(env, ["NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG"]);
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
    if (response.status === 204) {
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
