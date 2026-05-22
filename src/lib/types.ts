export type VideoStatus =
  | "pending_upload"
  | "uploading"
  | "processing"
  | "ready"
  | "error";

export interface Video {
  id: string;
  title: string;
  status: VideoStatus;
  mux_upload_id: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
