import { NextResponse } from "next/server";
import { readFirebaseWebConfigFromEnv, type FirebaseWebConfig } from "../../../../lib/firebase_config";

function readRuntimeFirebaseWebConfig(): FirebaseWebConfig | null {
  return readFirebaseWebConfigFromEnv(process.env, [
    "FIREBASE_WEBAPP_CONFIG",
    "NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG",
  ]);
}

export async function GET() {
  const config = readRuntimeFirebaseWebConfig();
  if (!config) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(config, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
