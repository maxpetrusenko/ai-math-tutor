import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      revision: process.env.APP_REVISION ?? process.env.K_REVISION ?? null,
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
