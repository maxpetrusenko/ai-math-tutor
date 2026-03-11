import { NextResponse } from "next/server";

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

function readRuntimeFirebaseWebConfig(): FirebaseWebConfig | null {
  const jsonConfig = process.env.FIREBASE_WEBAPP_CONFIG?.trim();
  if (jsonConfig) {
    try {
      return JSON.parse(jsonConfig) as FirebaseWebConfig;
    } catch {
      return null;
    }
  }

  for (const key of REQUIRED_FIREBASE_ENV_KEYS) {
    if (!process.env[key]?.trim()) {
      return null;
    }
  }

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  };
}

export async function GET() {
  const config = readRuntimeFirebaseWebConfig();
  if (!config) {
    return NextResponse.json({ error: "firebase config unavailable" }, { status: 404 });
  }

  return NextResponse.json(config, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
