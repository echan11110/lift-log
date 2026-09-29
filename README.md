# Lift Log

A mobile-first workout tracking app built with React + Vite + Supabase.

## Features

- Log workouts against a split — Push / Pull / Legs / Arms by default, or your own
  custom templates (Splits tab)
- Track exercises, sets, reps, weight — with inline dropset support
- Cardio logging with a per-entry unit (m, km, mi, steps, floors, or anything you type)
- Day, week and month views, plus a calendar date picker
- Progress charts per exercise with e1RM-based PR detection
- Auto-save — no manual save button. Pending edits are persisted locally and
  replayed if you go offline, close the tab, or lose signal mid-set
- Export everything to JSON or CSV (**Export** in the header) — there is no
  password reset, so keep a backup
- Installable to your home screen, with an offline app shell
- Dark theme, mobile-first

---

## Local Development

### 1. Clone and install

```bash
git clone <your-repo-url>
cd lift-log
npm install
```

### 2. Set up Supabase

1. Run `docs/schema.sql` in your Supabase project's SQL editor.
2. Create a `.env.local` file in the project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Both values are in your Supabase project under **Settings → API**.

### 3. Run

```bash
npm run dev
```

Open `http://localhost:5183/`.

In development the app is served from the root (`base` and `basename` are both
`/`); the `/lift-log/` prefix applies only to production builds for GitHub Pages.
The port is pinned to 5183 by `.claude/launch.json`; plain `vite` would use 5173.

### Tests

```bash
npm test
```

62 unit tests — date handling, ordering, e1RM/PR maths, the autosave write queue,
and the data export. The write-queue suite encodes the data-loss regressions
found in the 2026-09-28 audit, so keep it green.

---

## Deploy to GitHub Pages

### 1. Push to GitHub

Create a repo, add it as `origin`, and push to `main`.

### 2. Add Supabase secrets

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**

Add two secrets:
- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon key

### 3. Enable GitHub Pages

In your GitHub repo: **Settings → Pages**

- Source: **Deploy from a branch**
- Branch: `gh-pages` / `/ (root)`

The first deploy runs automatically when you push to `main`. After it completes (1–2 min), your app will be live at:

```
https://<your-username>.github.io/lift-log/
```

---

## Supabase Auth Setup

Email + password auth is enabled by default in all new Supabase projects. No extra configuration needed unless you've disabled it under **Authentication → Providers**.

To allow sign-ups without email confirmation (good for testing): **Authentication → Email → Disable "Confirm email"**.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite 5 |
| Styling | Tailwind CSS 3 |
| Routing | React Router 6 |
| Backend | Supabase (Auth + Postgres) |
| Charts | Recharts |
| CI/CD | GitHub Actions → GitHub Pages |
