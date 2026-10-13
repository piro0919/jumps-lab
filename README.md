# Jumps Lab

> A training log for jumpers — high jump, long jump, triple jump and pole vault.

https://jumpslab.kkweb.io

## Features

- Log each attempt with its mark, wind and note, as practice or competition
- Personal best, season best and practice best per event, with wind-aided marks kept out of PB and SB
- A day page with every event's attempts, plus condition (physical condition, fatigue, sleep, injury) and a practice note
- A log of past days, as a list or a calendar
- Practice and competition videos on each day, optionally linked to an attempt (up to 60 seconds and 100 MB each, 1 GB per person, deleted 90 days after upload with a save button)
- Compare two videos of the same event side by side or overlaid, synced at a chosen moment (such as take-off), in slow motion and frame by frame
- Mark moments on a video (approach start, last three steps, take-off, landing) and compare the times between them with another jump
- Competitions with venue, call room and start time, an entry site link, a countdown to the next one (at the top of home when it is within 14 days), the result from the marks logged that day, and a main goal meet
- In Japan: new competitions start with the JAAF entry site, and the competitions page links to each prefecture's meet schedule
- Today's advice on the home screen: how hard to train today from condition, sleep, injuries and the competition schedule, with a source for each reason
- Today's practice menu written by AI inside that intensity, with capped jump counts, and a chat to adjust it, for people on the Premium plan after they agree to sending their data to OpenAI (only when `OPENAI_API_KEY` is set)
- An admin screen at `/admin` to switch people between the Free and Premium plans (only for the emails in `ADMIN_EMAILS`)
- Analysis per event: count, average, monthly best and the trend of the last 10
- A push notification the evening before each competition, in each athlete's own time zone, turned on per device in Settings (only when the VAPID keys are set; on iPhone and iPad after adding the app to the Home Screen)
- The local weather on the home screen (Open-Meteo)
- Meters or feet and inches, English or Japanese, light or dark, weeks starting on Sunday or Monday

## Tech Stack

- Next.js (App Router) + React + TypeScript
- Better Auth (Google sign-in)
- Tailwind CSS + shadcn/ui (Base UI)
- PostgreSQL with raw SQL (Neon in production)
- Cloudflare R2 for videos (uploaded from the browser with presigned URLs)
- next-intl
- Vercel

## Development

```bash
pnpm install
pnpm db:up     # local Postgres on port 5436 (compose.yaml)
pnpm migrate   # apply db/migrations/
pnpm dev       # http://localhost:3110
```

Copy `.env.local.example` to `.env.local`:

| name                                                | value                                                         |
| --------------------------------------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`                                      | `postgres://jumpslab:jumpslab@localhost:5436/jumpslab`        |
| `BETTER_AUTH_SECRET`                                | `openssl rand -base64 32`                                     |
| `BETTER_AUTH_URL`                                   | `http://localhost:3110`                                       |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`          | Google OAuth client, redirecting to port 3110                 |
| `SENTRY_DSN`                                        | production only; leave empty locally                          |
| `R2_ENDPOINT`, `R2_BUCKET`                          | Cloudflare R2 account endpoint and the `jumps-lab-dev` bucket |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`          | an R2 API token limited to the dev bucket                     |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `pnpm exec next-push keys:generate`                           |
| `VAPID_SUBJECT`                                     | `https://jumpslab.kkweb.io`                                   |
| `CRON_SECRET`                                       | `openssl rand -base64 32`; the meet-reminder cron checks it   |

Without the R2 keys, everything except videos works. Without the VAPID keys, notifications are hidden.

To sign in locally without Google, `pnpm exec tsx --env-file=.env.local scripts/dev-session.ts` prints a session cookie for a test user (local database only).

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm knip
pnpm test       # Vitest, no database
pnpm test:db    # Vitest against a throwaway jumpslab_test database on the local Postgres (pnpm db:up)
pnpm test:e2e   # Playwright, on a production build, at desktop and mobile widths
```

## Database

Migrations live in `db/migrations/` and are applied in order by `scripts/migrate.ts`. Production is migrated by hand before the code that needs it is pushed; the Vercel build only checks (`migrate.ts --check`).

## Legal

Privacy policy and terms: https://jumpslab.kkweb.io/en/privacy, https://jumpslab.kkweb.io/en/terms
