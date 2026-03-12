import { NextResponse } from "next/server";

import { readFirebaseWebConfigFromEnv, resolveFirebaseWebConfigSource } from "../../../../lib/firebase_config";

export async function GET() {
  return NextResponse.json(
    {
      firebaseAuthRequired:
        typeof process.env.NEXT_PUBLIC_REQUIRE_FIREBASE_AUTH === "string"
          ? ["1", "true", "yes", "on"].includes(process.env.NEXT_PUBLIC_REQUIRE_FIREBASE_AUTH.trim().toLowerCase())
          : ["1", "true", "yes", "on"].includes((process.env.NERDY_REQUIRE_FIREBASE_AUTH ?? "").trim().toLowerCase()),
      firebaseConfigReady:
        readFirebaseWebConfigFromEnv(process.env, [
          "FIREBASE_WEBAPP_CONFIG",
          "NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG",
        ]) !== null,
      firebaseConfigSource: resolveFirebaseWebConfigSource(process.env, [
        "FIREBASE_WEBAPP_CONFIG",
        "NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG",
      ]),
      revision: process.env.K_REVISION ?? null,
      service: process.env.K_SERVICE ?? null,
      sessionWsUrl: process.env.NEXT_PUBLIC_SESSION_WS_URL ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
