"use client";

import { useRef, useState } from "react";
import type { Video } from "@/lib/types";

type UploadResponse = {
  video: Video;
  error?: string;
};

function uploadFileWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      try {
        const payload = JSON.parse(xhr.responseText) as { error?: string };
        reject(new Error(payload.error ?? `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error while uploading to the server"));
    };

    xhr.send(file);
  });
}

export function VideoUpload({ onUploaded }: { onUploaded: () => void }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const file = fileInputRef.current?.files?.[0];

    if (!trimmedTitle) {
      setError("Enter a title first");
      return;
    }

    if (!file) {
      setError("Choose a video file");
      return;
    }

    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const createResponse = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      const createPayload = (await createResponse.json()) as UploadResponse;

      if (!createResponse.ok) {
        throw new Error(createPayload.error ?? "Failed to start upload");
      }

      onUploaded();

      await uploadFileWithProgress(
        `/api/videos/${createPayload.video.id}/upload`,
        file,
        setProgress,
      );

      setTitle("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setProgress(null);
      onUploaded();
    } catch (uploadError) {
      setProgress(null);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Upload failed",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Upload a video</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Files upload to your Next.js server first, then to Mux storage (no
        browser CORS to Google Cloud).
      </p>

      <form className="mt-4 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        <label className="block text-sm font-medium text-zinc-800">
          Title
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 disabled:opacity-50"
            placeholder="My practice clip"
            value={title}
            disabled={isUploading}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="block text-sm font-medium text-zinc-800">
          Video file
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            disabled={isUploading}
            className="mt-1 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700"
          />
        </label>

        {progress !== null ? (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full bg-zinc-900 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">{progress}% to server</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isUploading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "Uploading…" : "Upload"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
