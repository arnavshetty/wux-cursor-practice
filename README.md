# Mux Practice

A small Next.js app to practice **Mux Video**: direct upload, webhook-driven status, SQLite catalog, and public playback with Mux Player.

## What it does

- Create a **direct upload** URL on the server (Mux API credentials never reach the browser)
- Upload files via **your server** (avoids browser CORS issues with Mux storage)
- Track each video in **SQLite** (title, status, asset/playback IDs)
- Update status from **Mux webhooks** (`video.upload.asset_created`, `video.asset.ready`, errors)
- Play **ready** videos with **Mux Player**
- **Delete** removes the row locally and deletes the Mux asset (or cancels a pending upload)

## Quick start

### 1. Environment

Copy the example file and add your values:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|----------|---------|
| `MUX_TOKEN_ID` | API access token ID |
| `MUX_TOKEN_SECRET` | API secret (shown once at creation) |
| `MUX_WEBHOOK_SIGNING_SECRET` | Verifies webhook signatures |
| `NEXT_PUBLIC_APP_URL` | App origin for upload CORS (`http://localhost:3000` locally) |

Use a Mux access token with **Mux Video Read + Write** only (public playback; no System/Data scopes required).

### 2. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Webhooks locally (ngrok)

Mux must reach your app to send events. For local development:

1. Start the app: `npm run dev`
2. In another terminal, expose port 3000:

   ```bash
   ngrok http 3000
   ```

3. In [Mux Dashboard → Settings → Webhooks](https://dashboard.mux.com/settings/webhooks), add an endpoint:
   - **URL:** `https://<your-ngrok-host>/api/webhooks/mux`
   - Copy the **signing secret** into `MUX_WEBHOOK_SIGNING_SECRET` in `.env.local`
4. Restart `npm run dev` after changing env vars.

**Deploy note:** In production (e.g. Vercel), set the webhook URL to `https://your-domain.com/api/webhooks/mux` and set `NEXT_PUBLIC_APP_URL` to the same origin. No ngrok needed.

**Alternative for local dev:** [Mux CLI](https://www.mux.com/docs/integrations/mux-cli) can forward webhooks without ngrok:

```bash
mux webhooks listen --forward-to http://localhost:3000/api/webhooks/mux
```

Use the signing secret the CLI prints for `MUX_WEBHOOK_SIGNING_SECRET`.

## Architecture

```text
Browser                    Next.js API                 Mux
   |                            |                        |
   |-- POST /api/uploads ------>|-- create direct upload->|
   |<-- upload URL + video id ---|<-----------------------|
   |-- POST file to /api/videos/[id]/upload ->| PUT to Mux storage ->|
   |                            |<----- webhooks --------|
   |                            |--- update SQLite        |
   |-- GET /api/videos --------->|                        |
   |-- Mux Player (playbackId) --------------------------------> CDN
```

SQLite lives at `data/mux-practice.db` (gitignored).

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/uploads` | POST | Create catalog row + Mux direct upload URL |
| `/api/videos` | GET | List your videos |
| `/api/videos/[id]` | DELETE | Delete from Mux + SQLite |
| `/api/webhooks/mux` | POST | Mux webhook handler |
| `/api/videos/[id]/upload` | POST | Stream file to Mux storage (server proxy) |
| `/api/health` | GET | Health + deployment warnings |
| `/api/config` | GET | Webhook vs poll sync mode |

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — run production build

## Deploy to production

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for:

- **Accounts & API keys** you need (Mux + host + optional auth)
- **Fly.io / Docker** deploy steps (best fit for this app)
- Webhooks, env vars, and security checklist

CI runs on GitHub Actions for every push/PR to `main` (lint + build).

Quick checks after deploy:

```bash
curl https://your-domain.com/api/health
curl https://your-domain.com/api/config
```

## Learning choices in this repo

- **Catalog:** SQLite (app-specific library, titles, webhook-friendly state)
- **Upload:** Server proxy locally (avoids browser CORS); consider direct upload in production
- **Ready detection:** Webhooks in production; Mux API poll fallback when webhooks are not configured
