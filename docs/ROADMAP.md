# Roadmap

Each phase ends with working, tested functionality and a commit/push. The next phase starts only after the current one works.

## Phase 1 – Foundation

- npm workspaces: `client`, `server`, `shared`.
- Vite + React + TypeScript + Tailwind; design tokens, light/dark and text-size switch, app layout (sidebar on desktop, bottom navigation on mobile), base components.
- Express + TypeScript: env validation, helmet, error handler, `/api/health`.
- Development MySQL on Railway (connected in Workbench), Prisma schema from [DATABASE.md](DATABASE.md), first migration, seed (built-in sports, achievement catalogue).
- i18n set up with all 7 languages (empty keys filled per phase).
- ESLint, Prettier, Vitest.

**Done when:** `npm run dev` starts client and server, the client shows the health status from the API, the migration runs on a clean database.

## Phase 2 – Authentication and profiles

- Register, login, logout, log out everywhere; argon2 hashing; session cookie; rate limiting.
- Password recovery by email.
- Profile editing (all fields from the brief), profile picture upload via object storage.
- Settings: account, privacy, notifications, language, appearance, text size, About.
- Account deletion including files.

**Done when:** a new user can register, log in, edit their profile and picture, change language/theme, reset their password and delete their account, with no data left in database or bucket.

## Phase 3 – Training

- Month/week calendar, coloured by sport.
- Add, edit and delete sessions (all 8 fields); custom sports and gyms.
- History list with filters.
- Basic statistics: training days, total hours, hours per sport.

**Done when:** sessions can be fully managed from the calendar on desktop and mobile, and totals match the database.

## Phase 4 – Dashboard and weekly reports

- Dashboard: all metrics from section C of the brief, filters (week, month, year, custom range), charts.
- Weekly goals (needed for goal achievement in reports; moved forward from phase 6).
- Report generation (scheduler, timezone, snapshot), report page, report archive, week-on-week comparison, rule-based conclusion.

**Done when:** tests with fixed data produce the correct numbers, streaks and conclusions; a report appears automatically after Sunday 18:00 in the user's timezone.

## Phase 5 – Social

- User search, friend requests (send, accept, decline, cancel), remove friend.
- Friend profiles and activity feed with privacy rules applied.
- Friend suggestions (mutual friends, same gym, same sports; only discoverable users, only public fields).
- Reactions and achievements, milestone notifications to friends.

**Done when:** the privacy test suite passes: no private field reachable for strangers, pending friends or friends without permission.

## Phase 6 – Additional features

- Weight tracking with mandatory photo evidence, history chart, deletion of entry + photo.
- Notification centre (in-app, unread count) with per-type preferences.
- Completing translations for all 7 languages, polishing dark mode and text sizes.

**Done when:** a weight entry without a photo is impossible; evidence is only visible to its owner; every interface text changes with the language.

## Phase 7 – Testing and deployment

- Playwright end-to-end tests for the main flows; responsive checks.
- Railway: app service, MySQL, bucket, variables, pre-deploy migration, health check.
- Production checklist: secure cookies, rate limits, upload limits, backups of the MySQL database.

**Done when:** the app runs on a Railway URL with a fresh database and all tests pass in CI.
