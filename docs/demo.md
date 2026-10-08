# Application Buddy reviewer demo

This is an interactive working prototype with fictional sample data. It runs separately from the real tracker and never connects to Gmail or Supabase. No database migration or reviewer account signup is needed.

## Local setup

Generate a private access code:

```sh
node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"
```

Add the generated value to `.env.local` as `DEMO_ACCESS_CODE`. It must be at least 12 characters. Restart `npm run dev` and open http://localhost:3000/demo/login. Leave `DEMO_ONLY` unset locally to keep the real workspace available.

## Deploy a dedicated reviewer link on Vercel

1. Push these changes to `mcdeverin/application_buddy`.
2. In Vercel, select Add New > Project and import that repository. Use the Next.js preset and repository root.
3. Add `DEMO_ACCESS_CODE` with your generated value and `DEMO_ONLY` with the value `true` to the production environment before deploying.
4. Deploy. Open the resulting production URL and verify the login before sharing the URL and access code with Liz.

This dedicated deployment does not need Google credentials, an encryption key, or Supabase credentials. All main workspace routes redirect to the demo when `DEMO_ONLY=true`. Do not commit the access code. Login sessions expire after eight hours; rotating the code invalidates existing sessions.

## What Liz can try

- Today: see upcoming interviews above recent applications, confirm an interview date, edit a sample availability reply, and complete interview preparation.
- Applications: search eight fictional applications and inspect stages, source emails, timelines, and sample resume versions.
- Interviews: see three upcoming interviews and their confirmation or preparation details.
- Email updates: simulate an application confirmation and then an interview invitation; watch the tracker add the application, update its stage, and create the interview and next step.
- Reset demo: return to the initial sample data.

Replies are simulations and send no email. Changes are kept in the current browser view and reset on refresh. A visible sample-data banner identifies the prototype throughout.

## Validation

Run `npm run test:demo`, `npm run lint`, and `npm run build`. The demo has also been checked in a browser for login, incorrect code rejection, date confirmations, edited replies, tasks, email simulations, source details, search, reset, mobile layout, sign-out, and isolation from Gmail and Supabase.
