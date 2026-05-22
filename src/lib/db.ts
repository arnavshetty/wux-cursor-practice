import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type { Video, VideoStatus } from "./types";

const DB_DIR = path.dirname(
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "mux-practice.db"),
);
const DB_PATH =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "mux-practice.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        mux_upload_id TEXT,
        mux_asset_id TEXT,
        mux_playback_id TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }
  return db;
}

function rowToVideo(row: Record<string, unknown>): Video {
  return {
    id: row.id as string,
    title: row.title as string,
    status: row.status as VideoStatus,
    mux_upload_id: (row.mux_upload_id as string | null) ?? null,
    mux_asset_id: (row.mux_asset_id as string | null) ?? null,
    mux_playback_id: (row.mux_playback_id as string | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function listVideos(): Video[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM videos ORDER BY datetime(created_at) DESC`,
    )
    .all();
  return rows.map((row) => rowToVideo(row as Record<string, unknown>));
}

export function getVideoById(id: string): Video | null {
  const row = getDb()
    .prepare(`SELECT * FROM videos WHERE id = ?`)
    .get(id);
  if (!row) return null;
  return rowToVideo(row as Record<string, unknown>);
}

export function getVideoByMuxUploadId(uploadId: string): Video | null {
  const row = getDb()
    .prepare(`SELECT * FROM videos WHERE mux_upload_id = ?`)
    .get(uploadId);
  if (!row) return null;
  return rowToVideo(row as Record<string, unknown>);
}

export function getVideoByMuxAssetId(assetId: string): Video | null {
  const row = getDb()
    .prepare(`SELECT * FROM videos WHERE mux_asset_id = ?`)
    .get(assetId);
  if (!row) return null;
  return rowToVideo(row as Record<string, unknown>);
}

export function createVideo(input: {
  id: string;
  title: string;
  mux_upload_id: string;
}): Video {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO videos (
        id, title, status, mux_upload_id, mux_asset_id, mux_playback_id,
        error_message, created_at, updated_at
      ) VALUES (?, ?, 'pending_upload', ?, NULL, NULL, NULL, ?, ?)`,
    )
    .run(input.id, input.title, input.mux_upload_id, now, now);
  return getVideoById(input.id)!;
}

export function updateVideo(
  id: string,
  patch: Partial<
    Pick<
      Video,
      | "status"
      | "mux_asset_id"
      | "mux_playback_id"
      | "error_message"
      | "title"
    >
  >,
): Video | null {
  const existing = getVideoById(id);
  if (!existing) return null;

  const next = {
    status: patch.status ?? existing.status,
    mux_asset_id: patch.mux_asset_id ?? existing.mux_asset_id,
    mux_playback_id: patch.mux_playback_id ?? existing.mux_playback_id,
    error_message:
      patch.error_message !== undefined
        ? patch.error_message
        : existing.error_message,
    title: patch.title ?? existing.title,
    updated_at: new Date().toISOString(),
  };

  getDb()
    .prepare(
      `UPDATE videos SET
        status = ?,
        mux_asset_id = ?,
        mux_playback_id = ?,
        error_message = ?,
        title = ?,
        updated_at = ?
      WHERE id = ?`,
    )
    .run(
      next.status,
      next.mux_asset_id,
      next.mux_playback_id,
      next.error_message,
      next.title,
      next.updated_at,
      id,
    );

  return getVideoById(id);
}

export function deleteVideo(id: string): boolean {
  const result = getDb().prepare(`DELETE FROM videos WHERE id = ?`).run(id);
  return result.changes > 0;
}
