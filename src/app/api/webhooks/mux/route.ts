import { NextResponse } from "next/server";
import {
  getVideoById,
  getVideoByMuxAssetId,
  getVideoByMuxUploadId,
  updateVideo,
} from "@/lib/db";
import { getMuxClient } from "@/lib/mux";

export const runtime = "nodejs";

type MuxWebhookPayload = {
  type: string;
  object?: { type?: string; id?: string };
  data?: Record<string, unknown>;
};

function resolveVideoId(event: MuxWebhookPayload): string | null {
  const data = event.data;
  const passthrough =
    typeof data?.passthrough === "string" ? data.passthrough : null;
  if (passthrough && getVideoById(passthrough)) {
    return passthrough;
  }

  if (event.object?.type === "upload" && event.object.id) {
    return getVideoByMuxUploadId(event.object.id)?.id ?? null;
  }

  const assetId =
    (typeof data?.asset_id === "string" ? data.asset_id : null) ??
    (typeof data?.id === "string" ? data.id : null) ??
    event.object?.id;
  if (assetId && event.object?.type === "asset") {
    return getVideoByMuxAssetId(assetId)?.id ?? null;
  }

  if (typeof data?.id === "string" && event.type.startsWith("video.asset.")) {
    return getVideoByMuxAssetId(data.id)?.id ?? null;
  }

  return null;
}

function playbackIdFromAssetData(data: Record<string, unknown>): string | null {
  const playbackIds = data.playback_ids;
  if (!Array.isArray(playbackIds)) return null;

  for (const item of playbackIds) {
    if (
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      typeof item.id === "string"
    ) {
      const policy =
        "policy" in item && typeof item.policy === "string"
          ? item.policy
          : "";
      if (policy === "public") return item.id;
    }
  }

  const first = playbackIds[0];
  if (
    typeof first === "object" &&
    first !== null &&
    "id" in first &&
    typeof first.id === "string"
  ) {
    return first.id;
  }

  return null;
}

function errorMessageFromData(data: Record<string, unknown>): string {
  const errors = data.errors;
  if (Array.isArray(errors)) {
    const messages = errors
      .map((entry) => {
        if (typeof entry === "object" && entry !== null && "message" in entry) {
          return String(entry.message);
        }
        return null;
      })
      .filter((value): value is string => Boolean(value));
    if (messages.length > 0) return messages.join(", ");
  }

  return "Mux reported an error during processing";
}

export async function POST(request: Request) {
  const body = await request.text();
  const secret =
    process.env.MUX_WEBHOOK_SIGNING_SECRET ?? process.env.MUX_WEBHOOK_SECRET;

  if (!secret) {
    console.error("Webhook signing secret is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  let event: Awaited<ReturnType<ReturnType<typeof getMuxClient>["webhooks"]["unwrap"]>>;

  try {
    const mux = getMuxClient();
    event = await mux.webhooks.unwrap(body, request.headers, secret);
  } catch (error) {
    console.error("Invalid Mux webhook signature", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const payload = event as unknown as MuxWebhookPayload;
  const videoId = resolveVideoId(payload);

  if (!videoId) {
    console.warn("No local video found for webhook", event.type, event.object?.id);
    return NextResponse.json({ received: true });
  }

  const data = payload.data ?? {};

  switch (payload.type) {
    case "video.upload.asset_created": {
      const assetId =
        typeof data.asset_id === "string" ? data.asset_id : null;
      if (assetId) {
        updateVideo(videoId, {
          status: "processing",
          mux_asset_id: assetId,
        });
      }
      break;
    }
    case "video.asset.ready": {
      const assetId = typeof data.id === "string" ? data.id : null;
      const playbackId = playbackIdFromAssetData(data);
      updateVideo(videoId, {
        status: "ready",
        mux_asset_id: assetId ?? undefined,
        mux_playback_id: playbackId,
        error_message: null,
      });
      break;
    }
    case "video.asset.errored":
    case "video.upload.errored": {
      updateVideo(videoId, {
        status: "error",
        error_message: errorMessageFromData(data),
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
