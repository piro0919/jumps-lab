@AGENTS.md

# Jumps Lab

A record-keeping service for jumpers (high jump, long jump, triple jump, pole vault). Built for a friend's request. The user of the app is the athlete themselves.

## Origin

- Spec source: <https://earnest-peony-78beee.netlify.app/> (the friend's prototype, "跳躍ラボ"). Clone its **spec only**.
- Reference only: <https://choyaku.renren-life.com/>
- Look and interaction are rebuilt for usability, modeled on the workout app **Strong** (open a session, add attempts one by one, bests detected automatically, bottom tabs). Check the real Strong screens before building a screen.

## Built for the whole world

The owner will make this app usable worldwide (said 2026-10-11). Do not design anything that only works in Japan.

- Before adding anything that depends on a country (school years, week start, dates, units, holidays, laws), decide what happens outside Japan first
- Grade: computed from the date of birth only for users whose time zone is Asia/Tokyo (Japanese school year: April, born April 2 to April 1). Everyone else picks it by hand. Stored as `grade` (manual) or `gradeOffset` (years off the computation)
- Still Japan-shaped, to revisit before going global:
  - The grade choices are the Japanese system (junior high, high school, college)
  - The calendar week starts on Sunday for everyone
  - Terms are under Japanese law with the Japanese text authoritative

## Decisions (agreed 2026-10-11)

- Name: Jumps Lab. URL: jumpslab.kkweb.io
- Languages: English (primary) and Japanese
- Units: store meters internally. Display and input switch between meters and feet/inches. Height and weight follow the same switch. Wind stays in m/s.
- Sign-in: Google only, and required. No signed-out use, no local-only mode
- Storage: Neon (Singapore). Vercel functions in sin1. Both on the owner's own accounts.
- Legal: privacy policy and terms in Japanese and English at /privacy, /terms, /en/privacy, /en/terms. Operator "kk-web", contact kk.web.kawamura@gmail.com. Japanese is the authoritative text, English is a translation with matching sections (spatto)
- Features in v1 (same as the prototype):
  - Profile: name, grade, date of birth (replaced age, agreed 2026-10-11), gender, height, weight, events, goal
  - Home: season goal, PB / SB / practice best, weather (Open-Meteo, location permission), days until next competition
  - Today: condition (physical condition 1–10, fatigue 1–10, sleep hours, injury note), attempts, practice note
  - Attempt: one at a time, with type (practice / competition), mark, wind (optional), note
  - Calendar: attempts and competitions per day, competition registration (venue, call room place and time, start time, notes)
  - Analysis: total count, average, monthly best, trend of the last 10
- PB / SB / practice best: show the higher of the value computed from attempts and the manually entered value
  - PB and SB count competition marks only; practice marks go to practice best
  - Season: January to December by default; the start month is a user setting
- Deferred:
  - Videos (a main feature for the friend). Design the attempts table so videos can be attached later.
  - AI advice (practice menu, form feedback)
  - Questions to a coach (the prototype's hidden "coach mode")
- Not in scope for now: per-height ○×– tracking for high jump and pole vault

## How this repo is built

Copy the shape of `~/Repository/onigiri` (which itself copies vocafy). Read its CLAUDE.md before adding something it already solved.

- Next.js 16 App Router, React 19.2, TypeScript 5, ESLint 9 (do not take TS/ESLint majors; renovate.json blocks them), Tailwind 4, pnpm 11 with `packageManager`, Node 24
- shadcn/ui on Base UI (nova preset, like waraiba and spatto). Generated parts live in `src/components/ui/` (knip ignores them); `src/components/layout-ui.tsx` wraps them with this app's sizes. Colors use the shadcn token names in `globals.css`
- No ORM (decided 2026-10-11): the data layer is one file of raw SQL in `src/lib/data.ts`; catch mistakes with tests instead of code generation
- `pnpm-workspace.yaml`: `allowBuilds` and `minimumReleaseAge: 4320`
- Prettier: singleQuote, trailingComma all, printWidth 100. ESLint and Prettier ignore `.claude/**` and `.playwright-mcp/**`
- lefthook: pre-commit eslint --fix, prettier, secretlint, typecheck (`next typegen && tsc --noEmit`); commit-msg commitlint (conventional, lower-case subject); pre-push vitest. Never bypass hooks
- knip, vitest (TZ=UTC, `server-only` stubbed), Playwright on the production build for desktop and Pixel 7 with `distDir` `.next-e2e` (vocafy)
- CI on push to main and on PRs: Postgres service, typecheck, lint, format:check, secretlint, test, knip, migrate, build; e2e as a separate job. Renovate PRs are only checked here
- `src/env.ts` with t3-env, imported from `next.config.ts`. Secrets are optional at build time and throw by name when used. Track `.env.local.example`
- `vercel.json`: `framework: "nextjs"`, `regions: ["sin1"]`, `buildCommand` runs `migrate.ts --check` before `pnpm build`. Stop Renovate branch builds with Ignored Build Step
- next.config: security headers (frame-ancestors none, X-Frame-Options DENY, nosniff, Referrer-Policy), `allowedDevOrigins: ['*.local']`
- `metadataBase` explicit, `alternates.canonical: './'`, no `openGraph.description` in the root layout

### Database

- `pg` with raw SQL, one pool in `src/lib/db.ts` with `attachDatabasePool`. No ORM, no Neon HTTP driver (transactions)
- Neon in aws-ap-southeast-1, compute fixed at 0.25 CU. Free tier is 100 CU-hours a month and 512MB; do not wake the DB for signed-out page views
- Migrations: `db/migrations/NNNN_name.sql`, `scripts/migrate.ts` (schema_migrations, advisory lock, `--check`). Apply to production by hand before pushing the code that needs them. Never edit an applied migration. Add columns before using them; drop in a later deploy
- Local Postgres via compose.yaml on a port no other repo uses (vocafy 5434, onigiri 5435)

### Sign-in

- Better Auth, self-hosted at `/api/auth/[...all]` (not Neon Auth: the Google consent screen would show neon.tech). Google only, scopes openid/email/profile
- Env: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Dedicated Google Cloud project; redirect URIs for production and a fixed localhost port
- Switch the consent screen from testing to production before release. Until then only test users can sign in
- The consent screen needs privacy policy and terms URLs that open without signing in. Keep those URLs fixed once submitted
- Use Google's own sign-in button design (unaltered G logo, white / #131314 / gray, Roboto)
- `useSession` returns null while pending: check `isPending` before treating someone as signed out
- Only devices that have signed in before ask for the session (vocafy's localStorage flag)

### Server code

- Every Server Action resolves the signed-in user itself; never trust an id from the browser. Apply the same input limits as the form
- Files that read secrets import `server-only`
- Return user-facing errors as values; production hides thrown messages
- If loading initial values fails, do not open an empty form that can overwrite saved data
- Guard submits against double press, including Enter, with a ref; let a primary key or unique constraint take the slot once, and treat only `23505` as "already exists"
- Personal API responses are `private, no-store`. Do not scope cookies to `.kkweb.io`

### Languages, units, time

- next-intl, English is the default. Messages in `messages/{en,ja}.json`, typed via `global.d.ts` so a missing key fails typecheck; test that both files have the same keys and no empty strings
- No locale in app URLs. Resolve from the user's setting, then Accept-Language honoring q weights, then English (spatto)
- Write whole sentences with placeholders; never join words in code
- Store keys and values, not rendered sentences, when text is saved and shown later
- Avoid symbols whose meaning changes by country (⭕, 👍); the prototype's emoji labels are not carried over
- Never take a date with `slice(0, 10)` of a timestamptz; format it in the user's time zone
- Plurals go through ICU plural in the message, never `count + 's'`. Test that en.json has no full-width punctuation
- English runs longer: check 390px and 1280px for clipped text
- "Today" is computed in the user's time zone; Vercel runs in UTC. Never hold "today" in a module-level constant
- Units are a display concern. Store meters (and cm/kg) and convert at the edges

### Screens

- Minimum width 375px, `viewportFit: 'cover'` with safe-area insets for the bottom tabs
- No explanatory text or notes on screens
- PWA: `app/manifest.ts` with `id: '/'`, no service worker. `favicon.ico` must be RGBA
- Vercel image optimization is billed; avoid it for user content

## Release checklist

- Vercel project under team `kkweb`, created with CLI or REST (the MCP returns 403). Check that framework is nextjs. New projects have Vercel Authentication on by default
- The proxy must leave open: sign-in, legal pages, manifest, icons, opengraph-image, robots, sitemap
- DNS in Cloudflare: CNAME (proxy off) and `_vercel` TXT
- Remove the `*.vercel.app` domain and confirm the custom domain returns 200
- `gh repo edit --homepage https://jumpslab.kkweb.io`
- `.github/FUNDING.yml` with `github: piro0919` and `buy_me_a_coffee: piro0919`
- Web Analytics is enabled by the owner in the dashboard, then redeploy
- Add a row to the Notion portfolio DB (English and Japanese descriptions), run `pnpm portfolio:export` in kk-web and commit
- Show the owner the real screens before release

## Current state

- Google Cloud project `jumps-lab-kkweb` (billing account kk-web). OAuth client "Jumps Lab web", redirect URIs `http://localhost:3110/api/auth/callback/google` and `https://jumpslab.kkweb.io/api/auth/callback/google`. Consent screen is External and still in Testing; `piro.haniwa@gmail.com` is the only test user
- Dev server runs on port 3110 (`pnpm dev`); local Postgres on 5436 (`pnpm db:up`, then `pnpm migrate`)
- Google sign-in works locally end to end
