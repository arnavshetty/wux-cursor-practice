import { NextResponse } from "next/server";
import { listVideos } from "@/lib/db";
import { syncInProgressVideosWithMux } from "@/lib/sync-mux";

export const runtime = "nodejs";

export async function GET() {
  await syncInProgressVideosWithMux();
  return NextResponse.json({ videos: listVideos() });
}
