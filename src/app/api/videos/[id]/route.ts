import { NextResponse } from "next/server";
import { deleteVideo, getVideoById } from "@/lib/db";
import { getMuxClient } from "@/lib/mux";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const video = getVideoById(id);

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const mux = getMuxClient();

    if (video.mux_asset_id) {
      await mux.video.assets.delete(video.mux_asset_id);
    } else if (video.mux_upload_id) {
      try {
        await mux.video.uploads.cancel(video.mux_upload_id);
      } catch {
        // Upload may already be completed or cancelled.
      }
    }

    deleteVideo(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete video", error);
    return NextResponse.json(
      { error: "Failed to delete video" },
      { status: 500 },
    );
  }
}
