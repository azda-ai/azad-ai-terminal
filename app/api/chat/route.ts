import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "Chat service is not configured on this deployment." },
    { status: 503 },
  );
}
