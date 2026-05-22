import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createVideo } from "@/lib/db";
import { getCorsOrigin, getMuxClient } from "@/lib/mux";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { title?: string };
    const title = body.title?.trim();

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    const videoId = uuidv4();
    const mux = getMuxClient();

    const upload = await mux.video.uploads.create({
      cors_origin: getCorsOrigin(request),
      new_asset_settings: {
        playback_policies: ["public"],
        passthrough: videoId,
      },
    });

    if (!upload.url) {
      return NextResponse.json(
        { error: "Mux did not return an upload URL" },
        { status: 500 },
      );
    }

    const video = createVideo({
      id: videoId,
      title,
      mux_upload_id: upload.id,
    });

    // Upload URL is used server-side only (avoids browser CORS to GCS).
    return NextResponse.json({ video });
  } catch (error) {
    console.error("Failed to create upload", error);
    return NextResponse.json(
      { error: "Failed to create upload" },
      { status: 500 },
    );
  }
}
