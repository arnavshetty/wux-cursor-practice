import { isWebhookConfigured } from "@/lib/env";
import { listVideos, updateVideo } from "@/lib/db";
import { getMuxClient } from "@/lib/mux";
import type { Video } from "@/lib/types";

function publicPlaybackId(
  playbackIds?: Array<{ id: string; policy?: string }>,
): string | null {
  if (!playbackIds?.length) return null;
  const pub = playbackIds.find((p) => p.policy === "public");
  return pub?.id ?? playbackIds[0]?.id ?? null;
}

async function syncOneVideo(video: Video): Promise<void> {
  if (!["processing", "uploading", "pending_upload"].includes(video.status)) {
    return;
  }

  const mux = getMuxClient();

  let assetId = video.mux_asset_id;

  if (!assetId && video.mux_upload_id) {
    const upload = await mux.video.uploads.retrieve(video.mux_upload_id);

    if (upload.status === "errored" || upload.status === "timed_out") {
      updateVideo(video.id, {
        status: "error",
        error_message:
          upload.error?.message ?? `Mux upload ${upload.status}`,
      });
      return;
    }

    if (upload.status === "asset_created" && upload.asset_id) {
      assetId = upload.asset_id;
      updateVideo(video.id, { mux_asset_id: assetId, status: "processing" });
    } else {
      return;
    }
  }

  if (!assetId) return;

  const asset = await mux.video.assets.retrieve(assetId);

  if (asset.status === "errored") {
    updateVideo(video.id, {
      status: "error",
      error_message: "Mux failed to process this asset",
    });
    return;
  }

  if (asset.status === "ready") {
    const playbackId = publicPlaybackId(asset.playback_ids);
    updateVideo(video.id, {
      status: "ready",
      mux_playback_id: playbackId,
      error_message: null,
    });
  }
}

/** Poll Mux for in-progress videos when webhooks are not configured. */
export async function syncInProgressVideosWithMux(): Promise<void> {
  if (isWebhookConfigured()) {
    return;
  }

  const videos = listVideos().filter((v) =>
    ["processing", "uploading", "pending_upload"].includes(v.status),
  );

  for (const video of videos) {
    try {
      await syncOneVideo(video);
    } catch (error) {
      console.error(`Mux sync failed for video ${video.id}`, error);
    }
  }
}
