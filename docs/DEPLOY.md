# Deployment Guide

This guide walks through deploying Pookie Notes to production.

## 1. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com/).
2. In **Authentication → Providers**, enable **Google** and add your Google OAuth client ID/secret.
3. In **Authentication → URL Configuration**, add your production URL (and `http://localhost:5173` for local dev) to the Redirect URLs.
4. Open the **SQL Editor** and run the contents of [`supabase/supabase.sql`](../supabase/supabase.sql). This creates the `profiles`, `couples`, and `notes` tables plus the row-level security policies that scope every couple's notes to just the two paired accounts.
5. Copy your **Project URL** and **anon public key** from **Project Settings → API** — you'll need them for environment variables.

## 2. Configure environment variables

The app reads two variables at build time:

```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Set these in a local `.env.local` file for development, and in your hosting provider's environment variable settings for production.

## 3. Build

```bash
npm install
npm run build
```

This produces a static `dist/` folder (via `tsc -b && vite build`) that can be served by any static host.

## 4. Deploy

Pookie Notes is a static single-page app, so it can be deployed to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages, etc.):

1. Connect your Git repository to your hosting provider.
2. Set the build command to `npm run build` and the output directory to `dist`.
3. Add the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables in the provider's dashboard.
4. Since this is a single-page app using client-side routing state, configure a fallback/rewrite rule so all paths serve `index.html`.

## 5. Post-deploy checklist

- Confirm the production URL is added to Supabase's Auth Redirect URLs, or Google sign-in will fail after redirect.
- Sign in with two different Google accounts and confirm pairing and realtime note sync both work end-to-end.
- Double check `.env.local` (and any other secrets) are excluded via `.gitignore` and were never committed.
