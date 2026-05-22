export type AppConfig = {
  appUrl: string;
  webhookConfigured: boolean;
  statusSync: "webhook" | "poll";
  nodeEnv: string;
};

function webhookSecret(): string | undefined {
  return (
    process.env.MUX_WEBHOOK_SIGNING_SECRET?.trim() ||
    process.env.MUX_WEBHOOK_SECRET?.trim() ||
    undefined
  );
}

export function isWebhookConfigured(): boolean {
  return Boolean(webhookSecret());
}

export function getAppConfig(): AppConfig {
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");

  const webhookConfigured = isWebhookConfigured();

  return {
    appUrl,
    webhookConfigured,
    statusSync: webhookConfigured ? "webhook" : "poll",
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}

export function requireMuxCredentials(): {
  tokenId: string;
  tokenSecret: string;
} {
  const tokenId = process.env.MUX_TOKEN_ID?.trim();
  const tokenSecret = process.env.MUX_TOKEN_SECRET?.trim();

  if (!tokenId || !tokenSecret) {
    throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set");
  }

  return { tokenId, tokenSecret };
}

export function getDeploymentWarnings(): string[] {
  const warnings: string[] = [];
  const config = getAppConfig();

  if (config.nodeEnv === "production") {
    if (!config.webhookConfigured) {
      warnings.push(
        "MUX_WEBHOOK_SIGNING_SECRET is not set — production should use Mux webhooks, not polling.",
      );
    }

    if (config.appUrl.includes("localhost")) {
      warnings.push(
        "NEXT_PUBLIC_APP_URL still points at localhost — set your production domain.",
      );
    }

    if (!process.env.DATABASE_PATH && !process.env.DATABASE_URL) {
      warnings.push(
        "Using default SQLite at data/mux-practice.db — ephemeral on serverless hosts; use Docker/VPS or migrate to Postgres.",
      );
    }
  }

  return warnings;
}
