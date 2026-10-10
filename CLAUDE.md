@AGENTS.md

# Jumps Lab

A record-keeping service for jumpers (high jump, long jump, triple jump, pole vault). Built for a friend's request. The user of the app is the athlete themselves.

## Origin

- Spec source: <https://earnest-peony-78beee.netlify.app/> (the friend's prototype, "跳躍ラボ"). Clone its **spec only**.
- Reference only: <https://choyaku.renren-life.com/>
- Look and interaction are rebuilt for usability. The visual model is **Nike Run Club** (since 2026-10-11; Strong was the first model and the screens kept the prototype's stacked cards, which the owner found uncool): numbers are the hero in Barlow Condensed extra bold italic with the label small below, secondary numbers in a row, rounded pill switches with the chosen one filled, recent items as cards with a row of numbers. Check the real NRC screens before building a screen.
- The frame follows **Strava** (since 2026-10-11; the owner wanted a sporty service instead of koidamashii and spatto). Read from the signed-in strava.com: the menu sits in the header, settings only in the avatar menu, the home is three columns (own card, feed, side cards), one loud color only on the action. The app's bottom tabs have Record in the middle. Take what fits, not everything (owner). The users are young athletes: aim for something that gets them fired up

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
  - Menu (agreed 2026-10-11): Home, Log, Competitions, Analysis. Settings from the avatar menu only
  - No app-wide "current event" (dropped 2026-10-11): home shows one card per chosen event, a day lists every event's attempts grouped by event, the event is picked in the add-mark drawer, and only analysis filters by event (`?event=`)
  - Log: days with marks or a condition, newest first, with a calendar view; a day (`/log/YYYY-MM-DD`, `/log/today`) holds its attempts, condition (physical condition 1–10, fatigue 1–10, sleep hours, injury note) and practice note
  - Attempt: one at a time, with type (practice / competition), mark, wind (optional), note
  - Competitions: upcoming and past lists, add/edit/delete (venue, call room place and time, start time, notes). A competition shows its result: the best mark per event among the attempts logged as "competition" on that date (legal marks first, else the best wind-aided one, marked)
  - Analysis: total count, average, monthly best, trend of the last 10, filtered by event (`?event=`) and by all / practice / competition (`?kind=`)
- PB / SB / practice best: show the higher of the value computed from attempts and the manually entered value
  - PB and SB count competition marks only; practice marks go to practice best
  - Wind-aided competition marks (tailwind over +2.0 m/s, long and triple jump) do not count for PB or SB; they show a "wind-aided" badge. Marks without a wind reading count (agreed 2026-10-11)
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
- Buttons come only from `src/components/ui/button.tsx` by name: variant default (the app blue) / brand (neon, "Log today" only) / secondary (grey) / ghost (icon only) / destructive / outline, size sm (36px, beside titles and in cards) / default (44px, form submit) / icon (36px). Never add height or padding where a button is used; link buttons take `buttonVariants(...)`. Segment pills are 36px too (`segmentClass`). The owner caught mixed sizes on 2026-10-11
- Design rules (the owner caught screens drifting apart on 2026-10-11). The values live at the top of `src/components/layout-ui.tsx`; `test/design-rules.test.ts` (vocafy's shape) fails on anything outside them. Change all three together
  - Type: page title 32px (`PageTitle`), section title 16px extrabold (`SectionTitle`, `CardTitle`), item titles and drawer titles `text-lg font-extrabold`, body `text-sm`, field labels 13px (`LABEL`), small text `text-xs`. Nothing above `text-lg` outside the parts
  - Weights: semibold, bold, extrabold. No medium
  - Numbers: always `DisplayNumber` or `Stat` (giant 88 / hero 64 / md 30 / sm 22). `font-display` is not written anywhere else
  - Badges (best, wind-aided, days left, required, event name, goal gap): `Badge` with a tone. Watermarks: `Watermark`
  - Choices: pick exactly one → a switch (`SEGMENTS` + `segmentClass`; gender, theme, list/calendar, kind); pick several → separate pills (events). The owner caught gender drawn as pills next to the multi-select events (2026-10-11)
  - Radius: full (buttons, badges, pills), xl (inputs, rows), 2xl (small panels inside a card), 3xl (cards)
  - Spacing: gap-3 between cards, p-5 inside, gap-4 between blocks inside a card
  - Page widths on desktop: list and view pages use the full frame; input pages (add attempt, condition, competition add/edit, settings) use `FORM_PAGE` (42rem, centered). Settings was wider than the other input pages until 2026-10-11
  - Actions: an action beside a card title is a labeled button (add is blue, edit is grey); actions on each row of a list are icon-only ghost buttons (pencil, trash). Empty lists and cards use `EmptyState` (the "no …" sentence plus a grey button to add, when there is something to add) and hide the title action
  - Desktop columns: `MAIN_SIDE` (main column plus a 20rem side column: home, analysis) or `HALVES` (two equal columns: the day page, competitions). Never write column widths per page; home and analysis drifted apart that way (owner, 2026-10-11)
  - Colors (owner, 2026-10-11): the app has one color, blue (`primary`), for buttons you press, what is selected, and the next-competition card. Nothing is filled black: black buttons, tabs and cards felt scary to the owner. Links stay ink. Other color only comes from the four event colors, the neon `brand` on "Log today", and red `destructive` for delete confirmations. No Tailwind palette classes (blue-600 etc.) outside the weather card's skies
  - No hex colors outside Google's button and the OG image
  - Header buttons beside a page title must fit at 375px in English: a short verb ("Add"), the title says what
- No ORM (decided 2026-10-11): the data layer is one file of raw SQL in `src/lib/data.ts`; catch mistakes with tests instead of code generation
- `pnpm-workspace.yaml`: `allowBuilds` and `minimumReleaseAge: 4320`
- Prettier: singleQuote, trailingComma all, printWidth 100. ESLint and Prettier ignore `.claude/**` and `.playwright-mcp/**`
- lefthook: pre-commit eslint --fix, prettier, secretlint, typecheck (`next typegen && tsc --noEmit`); commit-msg commitlint (conventional, lower-case subject); pre-push vitest. Never bypass hooks
- knip, vitest (TZ=UTC like Vercel, `server-only` stubbed). `test/server-guards.test.ts` (spatto's three guards): every Server Action calls `requireViewer`, every export in a "use server" file is async, every file that reads secrets imports `server-only`
- Playwright e2e (`pnpm test:e2e`) on the production build for desktop and Pixel 7, built into `.next-e2e` (vocafy). Sign-in skips Google: `e2e/session.ts` runs `scripts/dev-session.ts --fresh --user=e2e-…` and sets the signed cookie, so local runs never touch `dev-user`. The journey test caught pages crashing before the layout's welcome redirect; pages now use `requireProfile`
- squawk-cli on staged `db/migrations/*.sql` (`.squawk.toml`, koidamashii) and a hook that refuses edits to committed migrations
- Siblings' runtime packages in use: `@bprogress/next` (page progress bar; navigate in code with its `useRouter`), `use-pwa` + `react-ios-pwa-prompt` (Add to Home Screen button in the header), `use-show-window-size` (dev only). Considered and left out on 2026-10-11: sonner (forms navigate back, so no success toast), Speed Insights (owner does not want to pay), Lighthouse CI (pages are behind sign-in), boring-avatars, schema-dts, sharp
- CI on push to main and on PRs: `check` (Postgres service, typecheck, lint, format:check, secretlint, test, knip, migrate, build) and `e2e` (migrate, Playwright on `next start` inside GitHub Actions; no Vercel build, no Neon). Renovate PRs are only checked here
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

- Color theme (owner, 2026-10-11): Match device / Light / Dark, chosen in Settings > Display (the owner said theme belongs in settings, not the avatar menu). next-themes writes `data-theme` on html, as in koidamashii; `dark:` follows it. Event text colors have their own `--*-ink` tokens that lighten in dark so they stay above 4.5 on dark cards
- Settings is split into Profile, Records (events, units, season start), Display (theme) and Account (Google email, sign out). Profile and Records are separate cards with their own save at the bottom right, saved by separate actions that touch only their own columns (owner, 2026-10-11: "別々のほうがわかりやすい"). Sign-up shows both in one card and saves once It was one long profile form and looked like a profile page (owner, 2026-10-11)
- The avatar menu shows photo, name and email, then Settings and Sign out. The shadcn dropdown was restyled to 40px semibold rows and 2xl corners (owner: "見栄え終わってる")
- Frame (Strava): a sticky full-width frosted-glass header (`bg-background/70` with backdrop blur, no bottom line) with icon and name left, the four menus beside it from 1024px, and on the right "Log today" plus the avatar menu (name, settings, sign out). Phones get a bottom tab bar of Home, Log, a raised round "Log today" in the middle, Competitions, Analysis. "Log today" opens `/log/today?add=1`, which shows the add drawer at once and then drops `?add=1` from the address (reloading must not reopen it; pressing it again on the same page must)
- The brand color (neon yellow-green `--brand`, black text) is only for "Log today". Strava's orange clashes with the long jump color
- Weather card (owner, 2026-10-11): once the weather is known, the card is painted in that sky's color (like the iPhone weather widget; night is navy) with a big animated Meteocons fill picture (`@meteocons/svg`, MIT) hanging off the top right. Plain line icons were rejected as uncool. The sky runs left to right with the text side kept dark so white text stays above 4.5
- Input happens on its own page, never in a window (owner, 2026-10-11: "統一性がなくてわかりづらい"; the owner prefers page transitions). Add an attempt: `/log/[day]/new` (and `/log/today/new`). The day's condition and practice note: `/log/[day]/condition`; the day page only shows them with an Edit link, so the day page is view-only. Competitions: `/competitions/new` and `/competitions/[id]/edit`. Each page has the title with a back button (`<`) on its left (`PageTitle back`), one card with the form, and one Save button at the bottom right (`FormActions`; no Cancel, the back button and the browser back cover it; owner, 2026-10-11). Settings is itself an edit page and keeps its forms inline
- The one exception is the home numbers (personal best, season best, practice best, season goal): they are edited one at a time in a window (`MarkEditor` with `Sheet`: a bottom drawer on phones, a centered dialog from 1024px), because a quick fix of one number from home should not leave the page (owner, 2026-10-11). "Really delete?" confirmations are dialogs too
- Home from 1024px: three columns, own card (photo, name, events, jumps, days logged), event cards, next competition and weather
- Logo: the wordmark "JUMPS LAB" in Kanit ExtraBold Italic, upper case, via `Wordmark` in layout-ui (header and sign-in). The owner picked it from ten Google Fonts side by side (2026-10-11); Barlow Condensed stays for numbers only
- System Japanese font stack; shadcn's Geist (Latin only) was removed
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

- Released 2026-10-11 at https://jumpslab.kkweb.io. GitHub `piro0919/jumps-lab` is public (the owner: nothing special in it)
- Vercel team `kkweb`, project `jumps-lab`: framework nextjs, functions sin1, Vercel Authentication off for the custom domain only, `jumps-lab.vercel.app` removed. Renovate branches skip builds (`ignoreCommand` in vercel.json)
- Neon `jumps-lab-db` (free plan, sin1) through the Vercel Neon integration, which sets DATABASE_URL and friends. Migrations 0001–0006 applied to production by hand with DATABASE_URL_UNPOOLED. The 0.25 CU fixed compute is not checked yet
- Production env: BETTER_AUTH_SECRET (its own, not the local one), BETTER_AUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- DNS in Cloudflare (kkweb.io): CNAME `jumpslab` to Vercel (proxy off) and a `_vercel` TXT, added with the DNS-only token in janify's .env.local
- Google Cloud project `jumps-lab-kkweb`, OAuth client "Jumps Lab web". Consent screen External and in production since 2026-10-11, with home, /privacy and /terms set and no logo (a logo would need Google's review)
- Listed in the Notion portfolio DB and kk-web (WEB SERVICE, order 17)
- Web Analytics and Sentry are in the code and the privacy policy (section 5, ja and en) since 2026-10-11. Both send nothing yet:
  - Web Analytics: `<Analytics />` in the root layout. Turned on in the Vercel dashboard (Analytics tab) by the owner on 2026-10-11; counting starts with the next deploy. No cookies; Vercel keeps the page, referrer, country, device, OS and browser (https://vercel.com/docs/analytics/privacy-policy)
  - Sentry: server errors only, through `onRequestError` in `src/instrumentation.ts`; settings in `src/lib/monitoring.ts` (koidamashii's). v11 collects user, cookies, headers, bodies and query strings by default, so `dataCollection` turns them all off and `scrubEvent` (`src/lib/scrub-event.ts`, tested) deletes them again. The project is `jumps-lab` in the owner's Sentry org `kk-web` (team `piro`, US region, free Developer plan: 5k errors a month shared with koidamashii, spatto and chappie), created 2026-10-11. SENTRY_DSN (the project's client key) is set in Vercel production since 2026-10-11 (SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT would add source maps; not set). Keep what it sends inside what the privacy policy promises
- Not done: videos, AI advice, coach questions
- Dev server runs on port 3110 (`pnpm dev`); local Postgres on 5436 (`pnpm db:up`, then `pnpm migrate`)
