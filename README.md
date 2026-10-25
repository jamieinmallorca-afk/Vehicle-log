# Vehicle Log

A small, private web app for you and a few trusted friends to record sightings of parked vehicles
(photos, time, location, notes) and export a clean chronological PDF for the police.

## Stack (and why)

| Piece | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | One codebase for UI and API, deploys to Railway with zero config |
| Database | PostgreSQL (`pg`) | Railway provides it in one click |
| Images | Stored **inside Postgres** (`bytea`) | No public bucket, no extra service: photos can only be read through the login-protected API |
| Image processing | `sharp` | Resizes phone photos, fixes rotation, converts PNG/WebP to JPEG, keeps EXIF |
| PDF | `pdf-lib` | Pure JavaScript, no browser or native dependencies to break on Railway |
| Auth | Signed cookie, users from an env var | No user table, no third-party service |

## Project structure

```
middleware.ts            Blocks everything except /login until logged in (incl. photos)
schema.sql               Database schema (applied automatically on first request)
lib/
  session.ts users.ts    Signed-cookie sessions, user list from USERS env var
  auth.ts db.ts          Current-user helper, Postgres pool
  images.ts              Resize / rotate / hash uploaded photos
  pdf.ts                 PDF layout
  geo.ts format.ts       Coordinates / Google Maps link parsing, date formatting
app/
  login/                 Login page
  (app)/page.tsx         Dashboard: re-check banner, list, select, export
  (app)/new/             New entry / follow-up form
  (app)/entries/[id]/    Entry detail, delete, calendar reminder
  api/                   login, logout, entries, photos, export, recheck, reminder, health
components/              EntryForm, EntryList, DeleteButton
```

## Database schema

`entries` (id, created_by, created_at **auto**, occurred_at **editable**, location_text, lat, lng, vehicle,
notes, recheck_due_at, recheck_done_at, follow_up_of) and `photos` (id, entry_id, position, data, thumb,
sha256). Deleting an entry deletes its photos. Full SQL in `schema.sql`.

## How authentication works

- Users are defined in the `USERS` env var: `james:longpassword,anna:anotherlongpassword`.
- The **first user is the admin** (can delete anyone's entries); others can delete only their own.
- Login sets a signed, `HttpOnly`, `Secure`, `SameSite=Lax` cookie valid 30 days. Nothing is stored server-side.
- Remove someone from `USERS` and redeploy: their session stops working immediately.
- Every page and API route, including `/api/photos/*`, requires the cookie. Only `/login` and `/api/health` are public.
- 8 failed logins per IP per 15 minutes locks that IP out temporarily.

## How images stay private

Photos live in the database, not on a public URL or bucket. They are served only by `/api/photos/:id`,
which checks the session on every request, with `Cache-Control: private, no-store` and `noindex` headers.
The PDF is generated on demand and never stored.

## PDF export

On the dashboard tick entries, optionally open **PDF options** (title, cover note, full or compact photos),
and tap **Export PDF**. The PDF lists entries oldest first with date/time (with timezone), location, GPS and
map link, vehicle, notes, who recorded it and when (automatic server timestamp), and photos in a 2-column
grid. Each photo carries its SHA-256 hash so it can later be shown unaltered. Page numbers are in the footer.

Limitation: the PDF uses a standard font, so Latin text (English, Spanish, Catalan, German, French...) is fine,
but emoji and non-Latin scripts (Cyrillic, Arabic, CJK) print as `?`.

## Re-check reminder

Every entry gets a re-check date 10 days after the observation time (`RECHECK_DAYS`). When due, a banner
appears at the top of the dashboard: **Still there – add update** (opens a pre-filled follow-up entry and closes
the reminder) or **Gone / dismiss**. Each entry also has **Add re-check to calendar**, which downloads a
calendar file so your phone's own calendar alerts you even if you don't open the app.

## Deploy: GitHub + Railway

1. **Push to GitHub**
   ```bash
   cd vehicle-log
   git init && git add . && git commit -m "Initial commit"
   # create a PRIVATE repo on github.com, then:
   git remote add origin git@github.com:YOURNAME/vehicle-log.git
   git push -u origin main
   ```
2. **Railway** → New Project → **Deploy from GitHub repo** → pick the repo.
3. In the project, click **+ New → Database → Add PostgreSQL**.
4. Open your app service → **Variables** and add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `SESSION_SECRET` = output of `openssl rand -base64 48`
   - `USERS` = `yourname:long-unique-password,friend:another-long-password`
   - (optional) `APP_TIMEZONE`, `RECHECK_DAYS`
5. **Settings → Networking → Generate Domain**. Open it on your phone and log in.
6. Tables are created automatically on first use. Changing `USERS` or `SESSION_SECRET` = edit the variable
   and Railway redeploys. (Changing `SESSION_SECRET` logs everyone out.)

Tip: on your phone use "Add to Home Screen" for one-tap access.

## Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `SESSION_SECRET` | yes | 32+ random characters, signs login cookies |
| `USERS` | yes | `name:password,name2:password2` (first = admin; no commas in passwords) |
| `APP_TIMEZONE` | no | Default `Europe/Madrid` |
| `RECHECK_DAYS` | no | Default `10` |
| `PGSSL` | no | `true` to force SSL to Postgres |

## Local development

```bash
cp .env.example .env   # edit values; Next loads it automatically
npm install
npm run dev            # http://localhost:3000
```

## Security and privacy notes for this use case

- **Facts only.** Notes may be handed to police and could be disclosed to the people concerned. Record what you
  observe (time, place, condition, how it is parked), not accusations or guesses about who owns it.
- **Personal data.** Plates and photos of people are personal data (GDPR / Spanish LOPDGDD). Photograph the vehicle,
  not people or private property interiors, share the log only with the authorities, and delete entries you no
  longer need.
- **Backups.** Railway Postgres is your only copy. For anything important, export the PDF and keep it elsewhere.
- **Originals are not kept.** Photos are resized to 1800px JPEG. The camera's EXIF (time, and GPS if the phone
  recorded it) is preserved, but the original file is not. If police want originals, keep them on your phone too.
- **Passwords** are plain text in the Railway variable (visible to anyone with access to your Railway project).
  Use long unique ones and a private repo with 2FA on GitHub and Railway.
- **Google Maps links** are only opened when you tap them; no map is loaded automatically, so no location data
  goes to Google unless you choose.
- **Not a tamper-proof system.** Timestamps and hashes help credibility but the observation time is entered by
  the user, and an admin with database access could alter data. Don't present it as more than a personal log.
- Security headers, a same-origin check on all state-changing requests, `noindex`, and no-store caching are on
  by default. Each login is rate-limited per IP (in memory, resets on restart).
