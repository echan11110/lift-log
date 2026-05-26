# Lift Log

A mobile-first workout tracking app built with React + Vite + Supabase.

## Features

- Log workouts by split type (Push / Pull / Legs / Arms)
- Track exercises, sets, reps, weight — with inline dropset support
- Daily, weekly, and monthly views
- Progress charts per exercise with PR detection
- Auto-save — no manual save button
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

Open `http://localhost:5173/lift-log/`.

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
