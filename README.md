# Jumps Lab

> A training log for jumpers — high jump, long jump, triple jump and pole vault.

https://jumpslab.kkweb.io

## Features

- Log each attempt with its mark, wind and note, as practice or competition
- Personal best, season best and practice best per event, with wind-aided marks kept out of PB and SB
- A day page with every event's attempts, plus condition (physical condition, fatigue, sleep, injury) and a practice note
- A log of past days, as a list or a calendar
- Competitions with venue, call room and start time, a countdown to the next one, and the result from the marks logged that day
- Analysis per event: count, average, monthly best and the trend of the last 10
- The local weather on the home screen (Open-Meteo)
- Meters or feet and inches, English or Japanese, light or dark

## Tech Stack

- Next.js (App Router) + React + TypeScript
- Better Auth (Google sign-in)
- Tailwind CSS + shadcn/ui (Base UI)
- PostgreSQL with raw SQL (Neon in production)
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

| name                                       | value                                                  |
| ------------------------------------------ | ------------------------------------------------------ |
| `DATABASE_URL`                             | `postgres://jumpslab:jumpslab@localhost:5436/jumpslab` |
| `BETTER_AUTH_SECRET`                       | `openssl rand -base64 32`                              |
| `BETTER_AUTH_URL`                          | `http://localhost:3110`                                |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client, redirecting to port 3110          |
| `SENTRY_DSN`                               | production only; leave empty locally                   |

To sign in locally without Google, `pnpm exec tsx --env-file=.env.local scripts/dev-session.ts` prints a session cookie for a test user (local database only).

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm knip
pnpm test       # Vitest
pnpm test:e2e   # Playwright, on a production build, at desktop and mobile widths
```

## Database

Migrations live in `db/migrations/` and are applied in order by `scripts/migrate.ts`. Production is migrated by hand before the code that needs it is pushed; the Vercel build only checks (`migrate.ts --check`).

## Legal

Privacy policy and terms: https://jumpslab.kkweb.io/en/privacy, https://jumpslab.kkweb.io/en/terms
