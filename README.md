# Application Buddy

A personal job search workspace built with Next.js and Supabase.

## Run locally

```sh
npm ci
npm run dev
```

Keep these settings in `.env.local` (never commit credentials):

```text
NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your publishable key>
```

## Authentication setup

Email/password sign in, account creation, email confirmation and sign out are implemented. The dashboard requires a verified Supabase session. Session cookies refresh through Next.js Proxy.

In Supabase Authentication > URL Configuration, set Site URL to your local app URL (for example `http://localhost:3001`). In Authentication > Email Templates > Confirm signup, use this confirmation link:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
```

For deployment, update Site URL to the deployed origin. Keep email confirmation enabled.

## Current state

The dashboard still shows clearly labeled sample data. Database-backed applications, resume tracking, Gmail sync and AI interview preparation are the next implementation steps. Database access must be protected by user-specific RLS policies before connecting real records.

## Checks

```sh
npx tsc --noEmit
npm run lint
npm run build
```
