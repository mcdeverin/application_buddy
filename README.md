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

Message matching uses a focused Gmail search followed by a classifier requiring application or interview evidence. Job alerts, postings, shopping emails, financial applications and newsletters are excluded. Short incoming replies may inherit evidence from their exact Gmail thread. Old unrelated pending imports are ignored during sync. This heuristic is not guaranteed to catch every recruiter email. Parsed suggestions are heuristic, not AI. Clear matches update the tracker automatically; ambiguous matches need clarification. resume versions are not available from confirmation emails.

## Checks

```sh
npx tsc --noEmit
npm run lint
npm run build
```


## Automatic email updates

Run `supabase/migrations/20261008_email_automation.sql` in the Supabase SQL Editor after the email reader migration, then install dependencies with `npm install`. One Sync click follows all Gmail pages and processes saved pending imports automatically. The page must remain open until sync finishes; this is not a scheduled background worker. Progress is saved after each internal batch, and failed syncs can be resumed.

Clear company/role matches or a previously linked Gmail thread update the application and add an email timeline entry. New applications require explicit company, role and stage evidence. Ambiguous matches and newer manual edits go to Needs clarification. Ordinary conversation replies preserve the stage. Older confirmations may fill the applied date but cannot replace a newer email stage. Exact interview dates are retained in the excerpt for now; they are not inferred into calendar events.

Recent updates link to Gmail and provide Undo. Undo restores the previous application state and removes its generated timeline entry and unchanged task; later application changes or completed tasks block Undo to avoid overwriting user work. An application created by an undone import stays as Saved. Historical interview scheduling requests older than seven days do not create tasks. Existing ignored emails stay ignored.

Run `npm run test:email` for matching regression tests and PostgreSQL integration checks (including RLS, chronology, duplicate imports, tasks and Undo).

Gmail sync refreshes a rejected access token once, retries temporary failures with bounded backoff, skips messages removed since listing, and restarts a rejected saved cursor without changing the selected date. Already imported emails remain deduplicated. Persistent failures show the operation and a sanitized HTTP error code; tokens, email bodies and raw Google error messages are never included in the displayed error.


## Stored email identity repair

After applying the cleanup patch, run `supabase/migrations/20261008_email_identity_repair.sql`. Opening the dashboard automatically checks existing automatic imports using their stored subject, sender and excerpt, with no Gmail requests. Repairs apply only to the latest automatic update when the application has not been manually changed. Original company, role and status are retained in `email_imports.repair_data`. Manually accepted imports are not repaired automatically. Previously pending clarification emails get one matching pass with the improved parser, using stored content only. Details that cannot be confidently extracted are shown as unidentified rather than sentence fragments; their stored source excerpts remain intact.

The parser decodes HTML entities, trims receipt boilerplate, rejects generic role/company phrases and keeps confirmation emails at Applied unless there is an actual hiring decision or interview action. The dashboard uses the latest email date for imported applications and includes pending clarification items in Needs you. Upcoming interviews appear before Recent applications. The Interviews tab also shows past interview conversations, with email receipt dates clearly distinguished from scheduled interview times.
