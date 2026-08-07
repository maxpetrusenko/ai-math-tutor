import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      revision: process.env.K_REVISION ?? process.env.NERDY_FRONTEND_REVISION ?? null,
      service: process.env.K_SERVICE ?? process.env.NERDY_FRONTEND_SERVICE ?? null,
      sessionWsUrl: process.env.NEXT_PUBLIC_SESSION_WS_URL ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
