"use client";

import MuxPlayer from "@mux/mux-player-react";
import { useCallback, useEffect, useState } from "react";
import type { Video, VideoStatus } from "@/lib/types";

const STATUS_LABELS: Record<VideoStatus, string> = {
  pending_upload: "Waiting for file",
  uploading: "Uploading",
  processing: "Processing on Mux",
  ready: "Ready to play",
  error: "Error",
};

const STATUS_STYLES: Record<VideoStatus, string> = {
  pending_upload: "bg-zinc-100 text-zinc-700",
  uploading: "bg-amber-100 text-amber-800",
  processing: "bg-sky-100 text-sky-800",
  ready: "bg-emerald-100 text-emerald-800",
  error: "bg-red-100 text-red-800",
};

export function VideoLibrary({
  refreshKey,
  onRefresh,
}: {
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusSync, setStatusSync] = useState<"webhook" | "poll">("poll");
  const [pollIntervalMs, setPollIntervalMs] = useState(10_000);

  const loadVideos = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/videos", { cache: "no-store" });
      const payload = (await response.json()) as {
        videos: Video[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load videos");
      }

      setVideos(payload.videos);

      const stillExists = payload.videos.some(
        (video) => video.id === selectedId,
      );
      if (!stillExists) {
        const firstReady = payload.videos.find(
          (video) => video.status === "ready",
        );
        setSelectedId(firstReady?.id ?? payload.videos[0]?.id ?? null);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load videos",
      );
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [selectedId]);

  useEffect(() => {
    void fetch("/api/config")
      .then((res) => res.json())
      .then((payload: { statusSync: "webhook" | "poll"; pollIntervalMs: number }) => {
        setStatusSync(payload.statusSync ?? "poll");
        setPollIntervalMs(payload.pollIntervalMs ?? 10_000);
      })
      .catch(() => {
        setStatusSync("poll");
      });
  }, []);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos, refreshKey]);

  useEffect(() => {
    if (statusSync !== "poll") return;

    const hasInProgress = videos.some((video) =>
      ["pending_upload", "uploading", "processing"].includes(video.status),
    );

    if (!hasInProgress) return;

    const interval = window.setInterval(() => {
      void loadVideos({ silent: true });
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [loadVideos, videos, statusSync, pollIntervalMs]);

  const selectedVideo =
    videos.find((video) => video.id === selectedId) ?? null;

  async function handleDelete(videoId: string) {
    setDeletingId(videoId);
    setError(null);

    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete video");
      }

      if (selectedId === videoId) {
        setSelectedId(null);
      }
      onRefresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete video",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Your library</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {statusSync === "poll"
              ? "Polling Mux every 10s until ready (local dev without webhooks)."
              : "Status updates via Mux webhooks — use Refresh if needed."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadVideos({ silent: true })}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-zinc-500">Loading videos…</p>
      ) : videos.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">
          No videos yet. Upload one above.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {videos.map((video) => (
            <li
              key={video.id}
              className={`rounded-xl border p-4 ${
                selectedId === video.id
                  ? "border-zinc-900 bg-zinc-50"
                  : "border-zinc-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => setSelectedId(video.id)}
                >
                  <p className="font-medium text-zinc-900">{video.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(video.created_at).toLocaleString()}
                  </p>
                </button>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[video.status]}`}
                  >
                    {STATUS_LABELS[video.status]}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(video.id)}
                    disabled={deletingId === video.id}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === video.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>

              {video.error_message ? (
                <p className="mt-2 text-sm text-red-600">{video.error_message}</p>
              ) : null}

              {selectedId === video.id && video.status === "ready" && video.mux_playback_id ? (
                <div className="mt-4 overflow-hidden rounded-xl bg-black">
                  <MuxPlayer
                    playbackId={video.mux_playback_id}
                    metadata={{
                      video_title: video.title,
                    }}
                    style={{ width: "100%", aspectRatio: "16/9" }}
                  />
                </div>
              ) : null}

              {selectedId === video.id && video.status !== "ready" ? (
                <p className="mt-3 text-sm text-zinc-600">
                  Playback unlocks when Mux finishes processing and sends{" "}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
                    video.asset.ready
                  </code>
                  .
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {selectedVideo?.status === "ready" && !selectedVideo.mux_playback_id ? (
        <p className="mt-4 text-sm text-amber-700">
          Video is ready but missing a playback ID. Check webhook delivery.
        </p>
      ) : null}
    </section>
  );
}
