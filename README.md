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

Applications, tasks, notes and interview entries now use the existing user-owned Supabase tables. Gmail OAuth and manual sync import new job-related emails to a review queue; confirmed updates create/update an application and append an event atomically. No email is sent or deleted. Interview dates are added manually from excerpts. Resume uploads, AI extraction/prep, browser capture and background sync remain pending.

## Gmail reader setup

1. Run `supabase/migrations/20261008_email_reader.sql` in Supabase SQL Editor. This adds user-owned email tables and the atomic review function.
2. In Google Cloud, create/select a project and enable Gmail API.
3. Set up Google Auth Platform consent as an External app in Testing, and add your own Gmail address as a test user. Request only `https://www.googleapis.com/auth/gmail.readonly`.
4. Create an OAuth client of type Web application. Add this exact authorized redirect URI: `http://localhost:3000/auth/gmail/callback` (change port if your app uses another port).
5. Add the following to `.env.local`, keeping all server secrets private:

```text
GOOGLE_CLIENT_ID=<client ID>
GOOGLE_CLIENT_SECRET=<client secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/gmail/callback
EMAIL_TOKEN_ENCRYPTION_KEY=<base64 32-byte encryption key>
```

Generate the encryption key locally with:

```sh
node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64") + "\n")'
```

6. Restart `npm run dev`, sign in, and open Email reader → Connect Gmail. Approve Google's read-only consent yourself, then Sync new emails.
7. Review suggested company/role/stage and confirm or ignore each message. Imports start at connection time by default. Use Sync emails from to choose an earlier date, or One month ago for a quick history import. Changing the date restarts pagination for that range; the chosen range persists across reloads. Sync reads at most 30 matching messages per batch; repeated syncs continue pagination, and unique IDs prevent duplicate imports.

Testing-mode Google refresh tokens may expire after seven days; reconnect when needed. Public distribution of Gmail read access requires Google's verification process. This first version is for your own test account.

Tokens use AES-256-GCM encryption at rest. The encryption key stays server-side. Changing this key requires reconnecting Gmail. Disconnect removes stored credentials; you can additionally revoke app access in your Google account permissions. Reconnecting starts a new capture window; existing imports remain.

Message matching is a keyword search, not guaranteed coverage of every recruiter email. Parsed suggestions are heuristic, not AI. Every update requires review; resume versions are not available from confirmation emails.

## Checks

```sh
npx tsc --noEmit
npm run lint
npm run build
```
