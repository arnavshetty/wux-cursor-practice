"use client";

import { useCallback, useState } from "react";
import { VideoLibrary } from "@/components/VideoLibrary";
import { VideoUpload } from "@/components/VideoUpload";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  const bumpRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  return (
    <div className="min-h-full bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Mux practice
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            Upload, store, and play your videos
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-600">
            Direct uploads go to Mux. SQLite tracks titles and status. Public
            playback uses Mux Player when webhooks mark an asset ready.
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-2">
        <VideoUpload onUploaded={bumpRefresh} />
        <VideoLibrary refreshKey={refreshKey} onRefresh={bumpRefresh} />
      </main>
    </div>
  );
}
