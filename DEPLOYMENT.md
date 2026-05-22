# Deployment guide

This app works great locally. To run it in production, address these areas in order.

## What you need (accounts & secrets)

Nothing below is committed to Git — you add these in the host’s env UI or `fly secrets` / Railway variables.

| What | Required? | Where to get it |
|------|-----------|-----------------|
| **Mux account** | Yes | [dashboard.mux.com](https://dashboard.mux.com) (free tier is fine for practice) |
| **MUX_TOKEN_ID** + **MUX_TOKEN_SECRET** | Yes | Mux → Settings → Access Tokens → **Mux Video Read + Write** |
| **MUX_WEBHOOK_SIGNING_SECRET** | Yes in production | Mux → Settings → Webhooks → `https://YOUR_DOMAIN/api/webhooks/mux` → signing secret |
| **NEXT_PUBLIC_APP_URL** | Yes in production | Public `https://` URL (no trailing slash) |
| **Hosting account** | Yes | **Fly.io**, **Railway**, or Docker VPS (recommended). Vercel needs extra work. |
| **Auth provider** | Before public launch | Clerk / NextAuth — app has **no login** today |
| **Custom domain** | Optional | DNS at your host |

You do **not** need Mux Data or System scopes unless you add signed/private playback.

### Already in this repo

- `GET /api/health` and `GET /api/config`
- Webhook handler + webhook-first status sync
- `Dockerfile`, `fly.toml`, GitHub Actions CI

## 1. Hosting choice (important)

| Platform | SQLite catalog | Server upload route | Recommendation |
|----------|----------------|---------------------|----------------|
| **Fly.io / Railway / VPS + Docker** | Persistent volume | Works for large files | **Best fit for this repo as-is** |
| **Vercel / Netlify serverless** | Ephemeral filesystem | Body size & timeout limits | Needs DB migration + likely direct-to-Mux uploads |

**Why:** The catalog uses **SQLite** on disk (`data/mux-practice.db`). Serverless instances wipe local files between invocations. The upload API streams files through your server, which is fine on a long-lived Node process but costly/limited on serverless.

## 2. Production environment variables

Set these in your host (never commit real values):

```env
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
MUX_WEBHOOK_SIGNING_SECRET=          # required in production
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production

# Optional: absolute path to SQLite file on a persistent volume
DATABASE_PATH=/data/mux-practice.db
```

| Variable | Production notes |
|----------|------------------|
| `MUX_WEBHOOK_SIGNING_SECRET` | **Required.** Create webhook in [Mux Dashboard](https://dashboard.mux.com/settings/webhooks) pointing to `https://your-domain.com/api/webhooks/mux` |
| `NEXT_PUBLIC_APP_URL` | Must be your public `https://` origin (used for Mux upload CORS if you add browser uploads later) |
| `DATABASE_PATH` | Point at a **persistent volume** when using Docker/Fly/Railway |

Mux token scopes: **Mux Video Read + Write** (public playback).

## 3. Mux webhook (production)

1. Deploy the app and confirm `https://your-domain.com/api/health` returns `"ok": true`.
2. Mux Dashboard → **Settings → Webhooks** → add endpoint:
   - URL: `https://your-domain.com/api/webhooks/mux`
   - Environment: same as your API token
3. Copy the **signing secret** → `MUX_WEBHOOK_SIGNING_SECRET`
4. Redeploy / restart.

With webhooks configured:

- Mux pushes `video.asset.ready` etc.
- The app **stops** polling Mux on every `GET /api/videos` (fewer API calls, faster UI).

## 4. Deploy with Fly.io (recommended)

```bash
# One-time
fly auth login
fly launch                    # use existing fly.toml; don’t add Postgres
fly volumes create mux_data --size 1 --region sjc

# Secrets (paste real values when prompted)
fly secrets set MUX_TOKEN_ID=... MUX_TOKEN_SECRET=... \
  MUX_WEBHOOK_SIGNING_SECRET=... \
  NEXT_PUBLIC_APP_URL=https://YOUR_APP.fly.dev

fly deploy
```

Then in Mux Dashboard, set webhook URL to `https://YOUR_APP.fly.dev/api/webhooks/mux`.

Verify:

```bash
curl https://YOUR_APP.fly.dev/api/health
```

## 5. Deploy with Docker (any VPS)

```bash
docker build -t mux-practice .
docker run -p 3000:3000 \
  -v mux-practice-data:/data \
  -e MUX_TOKEN_ID=... \
  -e MUX_TOKEN_SECRET=... \
  -e MUX_WEBHOOK_SIGNING_SECRET=... \
  -e NEXT_PUBLIC_APP_URL=https://your-domain.com \
  -e DATABASE_PATH=/data/mux-practice.db \
  mux-practice
```

Put a reverse proxy (Caddy, nginx) in front for HTTPS if not using Fly/Railway.

## 6. Deploy to Vercel (extra work)

If you use Vercel:

1. **Database:** Move catalog to Postgres (Neon, Supabase, etc.) — SQLite will not persist.
2. **Uploads:** Prefer **browser → Mux direct upload** (Mux Uploader) with `cors_origin` = your Vercel URL, or use Mux's upload from URL flow — avoid large files through serverless functions.
3. Set all env vars in the Vercel project settings.
4. `vercel.json` in this repo increases upload body limits for the upload route, but very large videos may still hit platform caps.

## 7. Security checklist

- [ ] Rotate any token that was pasted in chat or committed by mistake
- [ ] Webhook signing secret set; `/api/webhooks/mux` rejects unsigned requests
- [ ] Mux credentials only on server (never `NEXT_PUBLIC_*` for secrets)
- [ ] HTTPS everywhere
- [ ] Add auth before public deploy (this app has **no login** — anyone with the URL can upload/delete)

## 8. Observability

- **Health:** `GET /api/health` — config + deployment warnings
- **Config:** `GET /api/config` — `webhook` vs `poll` sync mode
- Logs: watch server logs for `Mux storage PUT failed` and webhook signature errors

## 9. Next improvements (when you outgrow “practice”)

1. **Auth** (Clerk, NextAuth, etc.) — per-user video libraries
2. **Postgres** instead of SQLite for multi-instance deploys
3. **Direct browser uploads** in production (restore Mux Uploader + correct `cors_origin`) to skip server bandwidth
4. **Signed playback** if videos shouldn’t be public (`playback_policies: ["signed"]` + System signing keys)
5. **CI:** `npm run build` + lint on every PR
6. **Staging Mux environment** separate from production

## Quick verification after deploy

```bash
curl https://your-domain.com/api/health
curl https://your-domain.com/api/config
```

Upload a short clip → status should reach **Ready** via webhook without constant GET polling in the browser.
