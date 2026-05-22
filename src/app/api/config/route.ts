import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  const config = getAppConfig();
  return NextResponse.json({
    statusSync: config.statusSync,
    pollIntervalMs: 10_000,
    webhookConfigured: config.webhookConfigured,
  });
}
