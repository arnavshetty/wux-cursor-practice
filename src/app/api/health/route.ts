import { NextResponse } from "next/server";
import { listVideos } from "@/lib/db";
import {
  getAppConfig,
  getDeploymentWarnings,
  requireMuxCredentials,
} from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  const config = getAppConfig();
  const warnings = getDeploymentWarnings();

  try {
    requireMuxCredentials();
    listVideos();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        config,
        warnings,
        error: error instanceof Error ? error.message : "Health check failed",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    config,
    warnings,
  });
}
