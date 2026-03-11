import { NextResponse } from "next/server";

import { readFirebaseWebConfigFromEnv, resolveFirebaseWebConfigSource } from "../../../../lib/firebase_config";

export async function GET() {
  return NextResponse.json(
    {
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
