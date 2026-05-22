import Mux from "@mux/mux-node";
import { requireMuxCredentials } from "@/lib/env";

export function getMuxClient(): Mux {
  const { tokenId, tokenSecret } = requireMuxCredentials();
  return new Mux({
    tokenId,
    tokenSecret,
    webhookSecret:
      process.env.MUX_WEBHOOK_SIGNING_SECRET ??
      process.env.MUX_WEBHOOK_SECRET,
  });
}

export function getAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Browser origin for Mux direct-upload CORS (must match the page URL exactly). */
export function getCorsOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin) {
    return origin.replace(/\/$/, "");
  }

  const configured = getAppOrigin();
  if (process.env.NODE_ENV === "development") {
    // Allows localhost, 127.0.0.1, or LAN IPs during local dev.
    return process.env.MUX_CORS_ORIGIN ?? "*";
  }

  return configured;
}
