# Coach dashboard: one-time setup (about 10 minutes)

The app works without this. Clients' data stays on their phones until they connect to you.
Once it's set up, clients tap **Me → Your coach**, enter your invite code, and you see them on
`coach.html`. Only numbers are shared (sets, reps, weights, form scores, check-ins, app opens). Video never
leaves the phone.

## 1. Create the project
1. Go to supabase.com and sign up (free plan is fine to start).
2. **New project.** Pick a region close to your clients (e.g. London for the UK). Save the database password somewhere safe.

## 2. Create the tables and privacy rules
1. In the project: **SQL Editor → New query**.
2. Paste the whole of `supabase/schema.sql` and press **Run**. It should say "Success". (Already set up before food tracking? Run it again: it adds the `food_days` and `places` tables and keeps your data.)

## 3. Turn on email codes
1. **Authentication → Sign In / Providers → Email**: make sure Email is enabled.
2. **Authentication → Emails → Magic Link** template: replace the body with something like
   `Your Shred by QK code is {{ .Token }}`. The app asks for the 6-digit code, so the email must show `{{ .Token }}`.
3. For more than a few sign-ups an hour, add your own email sender under **Authentication → SMTP**.
   Supabase's built-in sender is rate-limited and meant for testing.

## 4. Make yourself the coach
1. Open `coach.html` on the live site and sign in with your email. This creates your account.
2. Back in **SQL Editor**, run this with your email:
   ```sql
   update public.profiles set role = 'coach', name = 'QK',
     invite_code = 'QK' || upper(substr(md5(random()::text), 1, 4))
   where id = (select id from auth.users where email = 'you@example.com');
   ```
3. Reload `coach.html`. Your invite code appears at the top right. Give it to your clients.

## 5. Connect the app
1. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
2. Put them in `js/cloud-config.js` (or send them to me and I'll do it):
   ```js
   export const CLOUD = { url: 'https://xxxx.supabase.co', anonKey: 'eyJ...' };
   ```
   The anon key is designed to be public. The privacy rules from step 2 decide what each person can see.

## What each person can see
| Who | Can see | Can change |
|---|---|---|
| Client | Only their own data and messages to them | Their own data; mark your messages read |
| Coach (you) | Only clients who joined with your code | Send cheers and nudges to your own clients |
| Anyone else | Nothing | Nothing |

These rules live in the database, so they hold even if someone edits the app. `npm run test:db` checks them
against a real Postgres. `node tests/cloud-e2e.cjs` checks the full client → coach → message loop.
