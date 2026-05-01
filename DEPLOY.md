# Deploy

V1 deploys to either Netlify or Vercel. Both build from the GitHub repo. Pick whichever you prefer.

> **Heads-up:** V1 ships **publicly accessible** — no auth gate (per [DECISIONS.md D4 + D7](./DECISIONS.md)). Treat the deployment URL as a soft secret. Don't post it publicly until app-level auth lands.

---

## Option A — Netlify (recommended)

### 1. Create a Netlify account
- Sign up at https://app.netlify.com/signup with the same GitHub account that owns `Kilojack82/BoosterIQ`.

### 2. Import the repo
- From your Netlify dashboard, click **Add new site → Import an existing project**.
- Pick **GitHub**, authorize Netlify if prompted, search for **BoosterIQ**.
- Netlify auto-detects Next.js. The build settings should be:
  - **Build command:** `pnpm build`
  - **Publish directory:** `.next`
  - **Branch to deploy:** `main`
- Click **Show advanced** → add the env vars below before clicking **Deploy**.

### 3. Environment variables
Click **Add environment variables** and paste each one. Pull values from your local `.env.local`:

| Key | Where to copy from |
|---|---|
| `ANTHROPIC_API_KEY` | `.env.local` (your `sk-ant-api03-...` key) |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` |
| `SUPABASE_SECRET_KEY` | `.env.local` |
| `NEXT_PUBLIC_APP_URL` | leave for now; Netlify will give you a `*.netlify.app` URL after first deploy. Update this var to that URL after the first deploy completes. |

Google / Square keys are not needed yet (those flows aren't wired into runtime endpoints).

### 4. Deploy
- Click **Deploy site**. First build takes ~3–4 minutes.
- When done, you'll get a URL like `https://booster-iq-xxxx.netlify.app`.
- Visit it — the dashboard should load with your real data.
- Update `NEXT_PUBLIC_APP_URL` in **Site configuration → Environment variables** to that URL, then trigger a redeploy from the **Deploys** tab.

### 5. Custom domain (optional)
- Netlify gives you a free `*.netlify.app` subdomain. If you own a domain (e.g. `boosteriq.app` or a subdomain of your existing site), wire it via **Domain management → Add domain**.

---

## Option B — Vercel (Next.js native)

### 1. Create a Vercel account
- https://vercel.com/signup, GitHub-authenticated.

### 2. Import the repo
- From dashboard, **Add New… → Project**.
- Pick **BoosterIQ**.
- Framework preset: **Next.js** (auto-detected).
- Build command: leave default (`pnpm build`).
- Output directory: leave default.

### 3. Environment variables
Same list as Netlify above. Vercel uses the same names.

### 4. Deploy
- Click **Deploy**. ~2–3 minutes.
- You'll get `https://boosteriq-xxxx.vercel.app`.
- Update `NEXT_PUBLIC_APP_URL` to that URL and redeploy.

---

## Option C — Netlify CLI from your terminal

For one-shot deploys without Git auto-deploy:

```
npm install -g netlify-cli
cd /Users/justinloucks/projects/BoosterIQ
netlify login
netlify init           # link to a Netlify site (creates one if needed)
netlify env:import .env.local
netlify deploy --prod
```

`netlify env:import` reads your local `.env.local` and uploads each variable to the Netlify site. Subsequent deploys use those values. After the first deploy, Netlify gives you the URL to update `NEXT_PUBLIC_APP_URL` to.

---

## After any deploy

1. Visit the URL. Dashboard should load. The data you've been using locally is already there because we share one Supabase database.
2. Open `/inventory` and re-upload your master inventory if you want to test that flow on the deployed instance.
3. Run a Square upload through the deployed site to validate the full path end-to-end.

## Known gotchas

- **First request is slow** (~5 sec) — Netlify cold-starts the serverless function. Subsequent requests are fast.
- **Anthropic API calls (~10–20 sec)** for receipt and Square PDF parsing — the deployed site has the same `maxDuration = 60` server config we set locally.
- **No auth in V1** — anyone who reaches the URL can upload, modify inventory, see volunteer names. Don't share the URL widely until app auth (DECISIONS.md D4) lands.
