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
- Grade (agreed 2026-10-11): only people in the Asia/Tokyo time zone have one (`usesGrade`). It is computed from the date of birth (Japanese school year: April, born April 2 to April 1) and stored as `gradeOffset` (years off the computation), or picked by hand as `grade` when there is no date of birth. Everyone else sees no grade field and stores none: school systems differ by country and nothing uses the grade yet. Add per-country grades if, say, US high schoolers ask for them
- Week start (agreed 2026-10-11): Sunday or Monday, a profile column (`weekStart`, migration 0008) set in Settings > Records. Sign-up starts from the browser's region (`src/lib/week.ts`: Intl week info, Saturday regions folded into Sunday; without it, the Americas and Sunday-first East Asian zones get Sunday). Existing people keep Sunday
- Time zone bug (found 2026-10-11): sign-up and settings saved every time zone as UTC (the hidden input was reset on re-render; now rendered from `useSyncExternalStore`). `TimeZoneRepair` in the app layout rewrites a saved UTC to the browser's zone once on open (owner agreed); other zones are never touched, so travel does not change them. Remove it once no profile in production is UTC
- Terms (agreed 2026-10-11): Japanese law and Japanese text stay authoritative (the operator is in Japan), with one added sentence in Article 8 (ja and en) keeping consumers' mandatory rights under their own country's law, including suing there. Not reviewed by a lawyer

## Decisions (agreed 2026-10-11)

- Name: Jumps Lab. URL: jumpslab.kkweb.io
- Languages: English (primary) and Japanese
- Units: store meters internally. Display and input switch between meters and feet/inches. Height and weight follow the same switch. Wind stays in m/s.
- Sign-in: Google only, and required. No signed-out use, no local-only mode
- Storage: Neon (Singapore). Vercel functions in sin1. Both on the owner's own accounts.
- Legal: privacy policy and terms in Japanese and English at /privacy, /terms, /en/privacy, /en/terms. Operator "kk-web", contact kk.web.kawamura@gmail.com, address the owner's virtual office (privacy section 1). Japanese is the authoritative text, English is a translation with matching sections (spatto)
- Features in v1 (same as the prototype):
  - Profile: name, grade, date of birth (replaced age, agreed 2026-10-11), gender, height, weight, events, goal
  - Home: season goal, PB / SB / practice best, weather (Open-Meteo, location permission), days until next competition
  - Menu (agreed 2026-10-11): Home, Log, Competitions, Analysis. Settings from the avatar menu only
  - No app-wide "current event" (dropped 2026-10-11): home shows one card per chosen event, a day lists every event's attempts grouped by event, the event is picked in the add-mark drawer, and only analysis filters by event (`?event=`)
  - Log: days with marks or a condition, newest first, with a calendar view; a day (`/log/YYYY-MM-DD`, `/log/today`) holds its attempts, condition (physical condition 1–10, fatigue 1–10, sleep hours, injury note) and practice note
  - Attempt: one at a time, with type (practice / competition), mark, wind (optional), note
  - Competitions: upcoming and past lists, add/edit/delete (venue, call room place and time, start time, notes, entry site URL, migration 0010). A competition shows its result: the best mark per event among the attempts logged as "competition" on that date (legal marks first, else the best wind-aided one, marked)
  - Analysis: total count, average, monthly best, trend of the last 10, filtered by event (`?event=`) and by all / practice / competition (`?kind=`)
- PB / SB / practice best: show the higher of the value computed from attempts and the manually entered value
  - PB and SB count competition marks only; practice marks go to practice best
  - Wind-aided competition marks (tailwind over +2.0 m/s, long and triple jump) do not count for PB or SB; they show a "wind-aided" badge. Marks without a wind reading count (agreed 2026-10-11)
  - Season: January to December by default; the start month is a user setting
- Deferred:
  - AI form feedback from video (the practice menu was built 2026-10-12, see the feedback notes below)
  - Questions to a coach (the prototype's hidden "coach mode")
- Not in scope for now: per-height ○×– tracking for high jump and pole vault
- Today's advice (agreed 2026-10-11 after two rounds of evidence research; the prototype's "AI practice menu" was not copied, the owner does not want it followed closely): a home card that sets today's intensity from the condition log and the schedule, with a source link per reason (`src/lib/readiness.ts`, tested). First match wins: protect the sore area (injury note; IOC youth consensus; never the "pain up to 5/10" model) → light before a meet (0–3 days) → taper (main goal meet within 14 days; Bosquet 2007) → lighter (last night ≤ 6 h, Craven 2022; 7-night average below 8 h under 18 / 7 h from 18, AASM/NSF; fatigue/condition worse than fixed 8/3 until 14 logs, then 2 off the person's own 28-day mean) → as planned. Competitions have an `isTarget` flag (migration 0009); the phase badge counts weeks to the main goal meet within 8 weeks, else "building". A fixed see-a-doctor text shows with any injury note. Numbers marked 仮決め in the code have no validated source. No ACWR. Jump counts and session contents have no evidence; the AI menu added on 2026-10-12 writes a session inside these limits only (no diagnosis, no "train through pain", no diet or weight advice), with capped jump counts
- Videos (agreed 2026-10-11; the friend's main feature): attached to a day like the prototype (which stored date, event, practice/competition, title and note, and only ever ran on a dev PC), any number per day, each with event, kind, an optional link to one attempt of that day, and a note. No title (file names are IMG_1234). Up to 60 s and 100 MB each, 1 GB per person in total (`src/lib/videos.ts`), deleted after 90 days (see the 2026-10-12 feedback below); usage shows in Settings > Account. Added on its own page (`/log/[day]/videos/new`), watched in place on the day page; a linked attempt gets a video mark. Deleting an attempt keeps its videos (the link goes)
  - Stored in Cloudflare R2, private buckets `jumps-lab` (production) and `jumps-lab-dev` (local), location APAC, created 2026-10-11 with wrangler. The browser uploads straight to R2 with a presigned PUT that signs the size and type (Vercel functions take 4.5 MB at most), so each bucket's CORS allows PUT from its origins only (production: jumpslab.kkweb.io; dev: localhost:3110 and 3312). Flow: reserve a pending row (quota counts pending) → PUT → HeadObject checks the size → ready. A failed upload releases its row at once; pending rows older than three hours (the PUT URL lasts 30 minutes, slow uploads run longer) are dropped with their objects. Content-Type is signed through `signableHeaders` (the SDK leaves it unsigned by default), and the quota check takes a per-user advisory lock. Length is checked in the browser only when it can be read (MediaRecorder webm has none, HEVC mov may not open on a PC) Playback uses presigned GET URLs made per page view
  - Keys: account API tokens "jumps-lab-dev local" (Object Read & Write on jumps-lab-dev only) in `.env.local`, and "jumps-lab production" (jumps-lab only) set in Vercel production as R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (the last two sensitive) on 2026-10-11. Migration 0007 was applied to production by hand on 2026-10-11. Wrangler's OAuth cannot create R2 tokens; they were made in the dashboard through the logged-in Playwright browser
- Feedback from 中元さん (2026-10-12, a Google Doc; agreed with the owner the same day):
  - Entry site: each competition has an optional entry URL (http/https only), shown as a link on upcoming ones. People in Japan (`inJapan` in `src/lib/japan.ts`, the same Asia/Tokyo check as grade) get the JAAF entry site (athleticfamily) filled in on new competitions
  - Prefecture schedules: Japan only, a card on the competitions page that opens the chosen prefecture's athletics association schedule (`PREFECTURE_LINKS`, the friend's list checked 2026-10-12). Links only, no scraping: reuse terms are unknown and call times must be checked by the athlete in the official notice. Entries marked `yearly` carry the year in the URL; update them every April. Kept as links only (owner, 2026-10-12, "十分使える"). If copying the notice by hand turns out to be the pain, the next step is reading one notice the athlete picks (URL or PDF) with AI to fill the competition form for them to confirm, not crawling all 47 sites; which one depends on whether athletes are told their meets or look for them (ask 中元さん's brother)
  - No launch screen (the prototype shows a full-screen countdown after a splash). Instead, when the next competition is within 14 days, its card sits at the top of home on phones too
  - Videos are deleted 90 days after upload (`VIDEO_KEEP_DAYS`; per plan later). Each row stores `expiresAt` (migration 0011; existing videos got 90 days from when it was applied); expired rows are hidden and not counted in the quota, and are cleared on the next upload. The objects are deleted by an R2 lifecycle rule `expire-videos` (prefix `videos/`, 91 days, one day after the shown date), set on jumps-lab-dev and jumps-lab on 2026-10-12. No cron: it needs no secret and does not wake Neon. Change the rule with the constant. Each video shows its deletion date and a save button (a presigned GET with `Content-Disposition: attachment`). Privacy policy section 7 says so (ja and en, updated 2026-10-12)
  - AI coach, first stage (built 2026-10-12): "Make today's menu" on the advice card (`/log/today/menu/new`: practice minutes and a note) → `createMenuAction` → one menu per day in `practice_menu` (migration 0012), viewed at `/log/[day]/menu` and linked from the day page. Intensity stays with `readiness.ts`; the AI (`MENU_MODEL` gpt-6-luna for everyone until plans exist, `src/lib/ai.ts` is the only place that calls a model, Responses API with a strict JSON Schema and `store: false`) writes the contents. `checkMenu` rejects a menu over the per-level caps (`LIMITS`: takeoffs and plyometric contacts, 仮決め; protect is 0 and 0) or 20% over the session length; one retry, then nothing is saved. Name and email are not sent; condition, sleep, pain note, practice note, the last 14 days of attempts and today's competition (venue, call room, times, notes) are. Every AI call is logged in `ai_call` before it is made (migration 0014) and `AI_CALL_LIMITS` caps calls per day and per month by kind (仮決め), so failed or rejected runs count too. On a day with a competition the menu is a warm-up timeline instead of a practice (owner left it to me, 2026-10-12): the form asks for warm-up minutes (default 60), the AI counts back from the call room time (or 30 minutes before the start, 仮決め) and sets `at` (HH:MM) on each item, warm-up and a short post-meet cool-down only, preMeet caps. Without OPENAI_API_KEY, or for anyone not on Premium, the button and pages do not appear (`aiEnabled(profile)`). The key is the friend's, in `.env.local` only; set in production on 2026-10-12; OpenAI is in the privacy policy since 2026-10-14
  - AI coach, second stage (built 2026-10-12, Premium only since 2026-10-14): "Ask the coach" chat under today's menu (`askMenuAction`, `CHAT_MODEL` gpt-6-luna). Each message re-runs `readiness`, sends the current menu, the last 10 messages and the same context; the AI returns a reply and, when it revises, the whole menu, which passes `checkMenu` before the row's `version` goes up (migration 0013: `version`, `minutes`, table `menu_message`; an optimistic check on `version` drops a concurrent second save). If the intensity changed since the menu was made, a revision is forced. A reply that changes nothing returns `menu: null` (cheaper) and keeps the version; replies are cut to 4000 characters to fit `menu_message`. Past days show the chat read-only
  - Billing on hold
- Feedback from 中元さん, second round (2026-10-14; our reply is the Claude Doc "ジャンプラボ フィードバックへのお返事"):
  - Plans (agreed with the owner): the app stays open to everyone; AI is Premium only. `profile.plan` is `free` or `premium` (migration 0015, everyone starts free), checked by `aiEnabled(profile)`. Names Free / Premium are provisional. Until billing exists, testers are switched by hand or from the admin screen `/admin` (built 2026-10-14) used by the owner and 中元さん: search by name or email (`?q=`, else the 50 newest users with a profile) and a Free / Premium switch per row (`setPlanAction`), nothing else. Admins are the Google emails in `ADMIN_EMAILS` (comma-separated, case-insensitive; `src/lib/admin.ts`); everyone else gets a 404 and no menu link, and the action re-checks. Videos stay open to everyone with today's caps; per-plan caps later. A team plan waits until a club signs up
  - Costs (sent to 中元さん, not confirmed yet): 中元さん pays the AI APIs (OpenAI, Gemini if tested), R2 and Neon, moved to accounts they create with the owner invited as a member; the owner keeps Vercel. 中元さん only promised API costs for development and 3–4 testers
  - AI consent (built 2026-10-14): before the first AI use, `/log/[day]/menu/new` shows a consent card instead of the form until the person agrees (`consentAiAction` sets `profile."aiConsentAt"` once, migration 0016). `aiUsable(profile)` (aiEnabled + consent) gates `createMenuAction` and `askMenuAction` server-side; a today's menu made before consent sends the person back to the card. The card lists what `menuContext` and the actions send (keep the list in `messages/*.json` `aiConsent` in step with the code; personal and season bests per event are sent since 2026-10-14, computed like home; practice best and goals are not. Changing the list means raising `AI_CONSENT_VERSION` in src/lib/ai.ts so people agree again; `profile."aiConsentVersion"`, migration 0017), says name and email are not sent, that the coach does not diagnose and to see a doctor when in pain, and the three items the PPC asks for when consent is the basis for providing to a third party abroad (country, that country's system, the recipient's measures; https://www.ppc.go.jp/all_faq_index/faq2-q5-8/ and https://www.ppc.go.jp/all_faq_index/faq1-q12-1/). The US system links the PPC summary (https://www.ppc.go.jp/enforcement/infoprovision/laws/offshore_report_america/, as of October 2021); OpenAI's measures only as read on https://developers.openai.com/api/docs/guides/your-data on 2026-10-14 (API data not used for training unless opted in, abuse monitoring logs up to 30 days) plus our `store: false`. Not reviewed by a lawyer. The privacy policy (sections 2, 3 and 5) says the same, with the date added; the consent list, the policy in ja and en and `menuContext` must be changed together
  - Asked 中元さん whether "大会一覧案" means aiming at university and adult athletes (their brother's answer: middle and high school teachers find meets)
  - On hold: numbers from video (knee angle, take-off position). The friend's five high jump videos (720p 30 fps, handheld, panning, three from the stands) gave no usable take-off joints with MediaPipe Pose; only form comments look feasible from such videos. Needs a tripod side-on 60 fps video to test the best case
  - The owner keeps every account (R2, OpenAI later) and runs development; costs are settled with 中元さん later
- Landing page (agreed 2026-10-11 after researching jump apps and sports app LPs): signed-out `/` shows the English LP (the proxy rewrites to `/en`, and `/en` itself redirects to `/`), `/ja` the Japanese one; signed-in people get home at `/` and are sent from `/ja` to `/`. The LP language comes from the URL (`x-page-locale` set by the proxy), not the browser, so both get indexed (hreflang en / ja / x-default). Layout: header with wordmark and a language switch only; hero "Built for every jump." / 「跳躍の、一本一本のために。」 with Google's button right there (Strava); a spec band (4 events, +2.0 m/s, m / ft, EN / JA, free); two photos; four feature sections (attempts, wind-legal bests, meets, analysis); a closing photo with the title and the button again; footer with the legal links. Screens are the app's own components fed sample data inside `PhoneFrame` (inert), never screenshots. Sample athlete: long and triple jump; the analysis sample is pole vault. Left out: user counts, reviews, store badges, a how-it-works strip, the origin story (needs the friend's consent), signed-out tools
  - Share images (2026-10-12; the first blue one was called ダサい): `src/app/share-image.tsx` draws both, English at `/opengraph-image` and Japanese at `/ja/opengraph-image-<hash>` (the proxy lets `ja/opengraph-image` through). The LP photo on the right with the athlete pushed right, the left darkened, the English headline in Kanit ExtraBold Italic on both. The Japanese one adds the Japanese LP headline small, in Noto Sans JP at weight 500 with wide letter spacing: two versions with the Japanese headline big in a black-weight gothic were both called ださい, and Japanese sports brands (Nike's Japanese running page, ASICS's "ASICS RUNNING") keep the big headline in English with small quiet Japanese. Fonts in `assets/og` with their OFL texts; Noto Sans JP is the variable font fixed at weight 500 with fonttools and kept whole (not subset, so editing the line cannot drop glyphs)
  - Photos are fictional athletes generated with ChatGPT (2026-10-12; driven through the logged-in Playwright browser), following the old Unsplash photos' composition only. The Unsplash terms (section 5) exclude recognizable people and logos from the license, so real athletes' faces could not front the LP or the share image; the owner wanted faces. Resized to 800/1600 WebP in `public/landing` (no Vercel image optimization). The proxy matcher skips `landing/`. A dark night photo melted into the dark theme, so pick bright ones

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
  - Desktop columns: `MAIN_SIDE` (main and side columns at 3:2: home, analysis; a fixed 20rem side column left the event cards stretched and the side text wrapping) or `HALVES` (two equal columns: the day page, competitions). Never write column widths per page; home and analysis drifted apart that way (owner, 2026-10-11)
  - Colors (owner, 2026-10-11): the app has one color, blue (`primary`), for buttons you press, what is selected, and the next-competition card. Nothing is filled black: black buttons, tabs and cards felt scary to the owner. Links stay ink. Other color only comes from the four event colors, the neon `brand` on "Log today", and red `destructive` for delete confirmations. No Tailwind palette classes (blue-600 etc.) outside the weather card's skies
  - No hex colors outside Google's button and the OG image
  - The LP has its own parts in layout-ui: `Headline` (Kanit italic upper case for Latin, system extrabold for Japanese) and `PhoneFrame` (its device corners are the one radius outside the scale, allowed only inside layout-ui). `PageTitle as="p"` inside frames keeps one h1 per page
  - Header buttons beside a page title must fit at 375px in English: a short verb ("Add"), the title says what
- Shared lint rules (`@piro0919/eslint-config`, at error level for `src/` since 2026-10-11, like vocafy): no unnamed numbers (name them; limits shared by forms and Server Actions live in `src/lib/limits.ts`) and no Tailwind `[...]` values (name them in the `@theme` block of `globals.css`). Tests, scripts, the OG image and shadcn's generated `src/components/ui/*` (except `button.tsx`) are outside. Import `cn` only from `@/lib/cn`: plain `cn` mistakes named text sizes like `text-button` for colors and drops one of them; add every new `--text-*` name there (a design-rules test checks both)
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
- No explanatory text or notes on screens. The one exception is the AI consent card, whose text is required by the APPI (2026-10-14)
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

## Working with the owner

- Push only when the owner says so, and in one batch: every push to main is a Vercel production build the owner pays for (said 2026-10-11 after several pushes in a row). Commit locally meanwhile
- Before a push with behavior changes, run `/code-review` and fix only the confirmed findings
- The owner can run shell commands in VSCode's terminal, not with `!` in the Claude Code chat (it arrives as plain text)

## Current state

- Released 2026-10-11 at https://jumpslab.kkweb.io. GitHub `piro0919/jumps-lab` is public (the owner: nothing special in it)
- Vercel team `kkweb`, project `jumps-lab`: framework nextjs, functions sin1, Vercel Authentication off for the custom domain only, `jumps-lab.vercel.app` removed. Renovate branches skip builds (`ignoreCommand` in vercel.json)
- Neon `jumps-lab-db` (free plan, sin1) through the Vercel Neon integration, which sets DATABASE_URL and friends. Migrations 0001–0017 applied to production by hand with DATABASE_URL_UNPOOLED (0010–0014 on 2026-10-12, 0015–0017 on 2026-10-14). Project `square-grass-26844004` in the Neon org "Vercel: kk-web"; its endpoint is fixed at 0.25 CU with the default suspend (checked with `neonctl api` on 2026-10-11)
- Production env: BETTER_AUTH_SECRET (its own, not the local one), BETTER_AUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SENTRY_DSN, R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY. ADMIN_EMAILS (not sensitive) holds the owner's and 中元さん's Google emails (2026-10-14). The admin screen stays on the same domain until it handles more than plans (usage, billing); then split it behind its own gate (owner agreed 2026-10-14). OPENAI_API_KEY (sensitive, 中元さん's key, set by the owner on 2026-10-12): the AI menu and chat are live in production, for Premium people only since 2026-10-14 (the owner switched themselves on from /admin; testers are switched when their emails arrive)
- DNS in Cloudflare (kkweb.io): CNAME `jumpslab` to Vercel (proxy off) and a `_vercel` TXT, added with the DNS-only token in janify's .env.local
- Google Cloud project `jumps-lab-kkweb`, OAuth client "Jumps Lab web". Consent screen External and in production since 2026-10-11, with home, /privacy and /terms set and no logo (a logo would need Google's review)
- Listed in the Notion portfolio DB and kk-web (WEB SERVICE, order 17)
- Web Analytics and Sentry are in the code and the privacy policy (section 5, ja and en), live in production since 2026-10-11 (the analytics script loads on production; no Sentry event has arrived yet to confirm delivery):
  - Web Analytics: `<Analytics />` in the root layout. Turned on in the Vercel dashboard (Analytics tab) by the owner on 2026-10-11. No cookies; Vercel keeps the page, referrer, country, device, OS and browser (https://vercel.com/docs/analytics/privacy-policy)
  - Sentry: server errors only, through `onRequestError` in `src/instrumentation.ts`; settings in `src/lib/monitoring.ts` (koidamashii's). v11 collects user, cookies, headers, bodies and query strings by default, so `dataCollection` turns them all off and `scrubEvent` (`src/lib/scrub-event.ts`, tested) deletes them again. The project is `jumps-lab` in the owner's Sentry org `kk-web` (team `piro`, US region, free Developer plan: 5k errors a month shared with koidamashii, spatto and chappie), created 2026-10-11. SENTRY_DSN (the project's client key) is set in Vercel production since 2026-10-11 (SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT would add source maps; not set). Breadcrumbs are dropped entirely (console breadcrumbs can carry a failed row's marks and notes). Keep what it sends inside what the privacy policy promises
- Everything is pushed and live (2026-10-11): the landing page, videos, today's advice with the main goal meet, grade only in Japan, week start, the terms sentence, the shared lint rules at error level, and the UTC time zone fix with its one-time repair
- Not yet checked:
  - Uploading and playing a video in production (needs the owner's Google sign-in on a phone; works locally against jumps-lab-dev)
  - How many production profiles were saved as UTC (reading production was blocked by the permission classifier); remove `TimeZoneRepair` once none are left
  - The analysis page at 3:2 was not looked at after the layout change (home was)
- Not done:
  - The AI menu went live on 2026-10-12 because the owner asked for it with the items below set aside ("規約とか諸々一回置いといて"). Still open, in this order:
    - A key under the owner's account (production uses 中元さん's key for now, so user data goes through their account and they pay)
    - Done and live 2026-10-14: the privacy policy lists OpenAI (sections 2, 3 and 5, ja and en) and a consent step comes before the first menu, after checking the PPC's guidance on providing to a third party abroad (see the consent bullet). No lawyer review, like the terms
    - Joint use (共同利用, APPI Art. 27(5)(iii); PPC general guideline): section 4 (ja and en) lists the items (everything in section 2, so the later R2 and Neon move fits; items and joint users cannot in principle be changed later), joint users "kk-web, れんれん", purposes and kk-web as the one responsible. "れんれん" is a placeholder the owner chose on 2026-10-14 until 中元さん's full name or trade name is agreed (a surname alone may not identify them). kk-web's address in section 1 (ja and en) is the owner's virtual office (METS Office light plan, no mail receiving, from 2026-10-01; the same one spatto's promo emails use), agreed 2026-10-14
  - Coach questions (the prototype's hidden coach mode)
- Dev server runs on port 3110 (`pnpm dev`); local Postgres on 5436 (`pnpm db:up`, then `pnpm migrate`)
