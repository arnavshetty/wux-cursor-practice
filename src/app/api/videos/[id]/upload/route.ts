import { NextResponse } from "next/server";
import { getVideoById, updateVideo } from "@/lib/db";
import { getMuxClient } from "@/lib/mux";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const video = getVideoById(id);

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (!video.mux_upload_id) {
      return NextResponse.json(
        { error: "No Mux upload associated with this video" },
        { status: 400 },
      );
    }

    if (!request.body) {
      return NextResponse.json({ error: "Missing file body" }, { status: 400 });
    }

    const mux = getMuxClient();
    const muxUpload = await mux.video.uploads.retrieve(video.mux_upload_id);

    if (!muxUpload.url) {
      return NextResponse.json(
        { error: "Mux upload URL is no longer available" },
        { status: 400 },
      );
    }

    if (muxUpload.status !== "waiting") {
      return NextResponse.json(
        { error: `Upload already ${muxUpload.status}` },
        { status: 409 },
      );
    }

    updateVideo(id, { status: "uploading" });

    const contentType =
      request.headers.get("content-type") ?? "application/octet-stream";
    const contentLength = request.headers.get("content-length");

    const putHeaders: Record<string, string> = {
      "Content-Type": contentType,
    };
    if (contentLength) {
      putHeaders["Content-Length"] = contentLength;
    }

    const putResponse = await fetch(muxUpload.url, {
      method: "PUT",
      headers: putHeaders,
      body: request.body,
      duplex: "half",
    } as RequestInit);

    if (!putResponse.ok) {
      const errorText = await putResponse.text().catch(() => "");
      console.error("Mux storage PUT failed", putResponse.status, errorText);
      updateVideo(id, {
        status: "error",
        error_message: `Storage upload failed (${putResponse.status})`,
      });
      return NextResponse.json(
        { error: "Failed to upload file to Mux storage" },
        { status: 502 },
      );
    }

    updateVideo(id, { status: "processing" });

    return NextResponse.json({ ok: true, status: "processing" });
  } catch (error) {
    console.error("Server upload failed", error);
    return NextResponse.json(
      { error: "Server upload failed" },
      { status: 500 },
    );
  }
}
