export type FirebaseWebConfig = {
  apiKey: string;
  appId: string;
  authDomain: string;
  measurementId?: string;
  messagingSenderId: string;
  projectId: string;
  storageBucket: string;
};

export const REQUIRED_FIREBASE_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

type EnvLike = Record<string, string | undefined>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeFirebaseWebConfig(value: unknown): FirebaseWebConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<FirebaseWebConfig>;
  if (
    !isNonEmptyString(candidate.apiKey) ||
    !isNonEmptyString(candidate.appId) ||
    !isNonEmptyString(candidate.authDomain) ||
    !isNonEmptyString(candidate.messagingSenderId) ||
    !isNonEmptyString(candidate.projectId) ||
    !isNonEmptyString(candidate.storageBucket)
  ) {
    return null;
  }

  return {
    apiKey: candidate.apiKey,
    appId: candidate.appId,
    authDomain: candidate.authDomain,
    measurementId: isNonEmptyString(candidate.measurementId) ? candidate.measurementId : undefined,
    messagingSenderId: candidate.messagingSenderId,
    projectId: candidate.projectId,
    storageBucket: candidate.storageBucket,
  };
}

export function readFirebaseWebConfigJson(rawValue: string | undefined): FirebaseWebConfig | null {
  if (!isNonEmptyString(rawValue)) {
    return null;
  }

  try {
    return normalizeFirebaseWebConfig(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export function readFirebaseWebConfigFromEnv(
  env: EnvLike,
  jsonKeys: readonly string[] = ["NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG"]
): FirebaseWebConfig | null {
  for (const key of jsonKeys) {
    const jsonConfig = readFirebaseWebConfigJson(env[key]);
    if (jsonConfig) {
      return jsonConfig;
    }
  }

  for (const key of REQUIRED_FIREBASE_ENV_KEYS) {
    if (!isNonEmptyString(env[key])) {
      return null;
    }
  }

  return normalizeFirebaseWebConfig({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export function resolveFirebaseWebConfigSource(
  env: EnvLike,
  jsonKeys: readonly string[] = ["NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG"]
): string | null {
  for (const key of jsonKeys) {
    if (readFirebaseWebConfigJson(env[key])) {
      return key;
    }
  }

  for (const key of REQUIRED_FIREBASE_ENV_KEYS) {
    if (!isNonEmptyString(env[key])) {
      return null;
    }
  }

  return "NEXT_PUBLIC_FIREBASE_*";
}
