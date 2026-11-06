# Architecture

## 1. Starting point

There is no existing PACE code: the GitHub repository was empty and no PACE folder existed locally. The project starts from scratch, so there is no working code that could be overwritten.

Local tooling found: Node.js 26, npm, git, GitHub CLI, Homebrew and MySQL Workbench. There is no local MySQL server: development runs against a MySQL database on Railway (see [CHALLENGES.md](CHALLENGES.md#10-development-database)).

## Decisions taken

| Topic                         | Decision                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Database (dev + prod)         | Railway MySQL, inspected with MySQL Workbench                                             |
| File storage                  | Railway Storage Bucket (private)                                                          |
| Email                         | Gmail SMTP with an app password, behind a replaceable adapter                             |
| Streak                        | Consecutive weeks reaching the training-day goal; a week below the goal resets it         |
| Motivation, rating, intensity | Scale 1–5                                                                                 |
| Discoverability               | On by default; only username, first name and profile picture are shown                    |
| Training dates                | Logged up to today in the user's timezone; no planned (future) sessions                   |
| Weeks                         | Monday to Sunday (ISO 8601)                                                               |
| Custom sports                 | Private to their owner; colour from a fixed palette; deletable once unused                |
| Goals history                 | Editing or deleting a goal archives it; each week is measured against its own goals       |
| Missed reports                | After downtime only the most recent due week is caught up, never older weeks              |
| Declined friend requests      | Look pending to the sender; nobody learns they were declined                              |
| Friend suggestions            | Ranked by mutual friends, gym and sports; only "mutual friends" is shown as reason        |
| Achievements                  | Awarded from own data after saving a session or goal and at report time; never revoked    |
| Weight sharing                | Private by default; when shared, friends see values and dates only, never photos or notes |
| Notifications                 | In-app, per-type settings; read ones are removed after 90 days                            |
| Charts                        | Small own components (no chart library), each with a tooltip and a table view             |

## 2. Repository structure

One repository (a "monorepo") with npm workspaces. Frontend and backend are separate packages; code both of them need lives in `shared`.

```
Pace/
├── client/                 React + TypeScript + Vite + Tailwind
│   └── src/
│       ├── app/            router, providers (query client, i18n, theme)
│       ├── components/     reusable UI: Button, Card, Modal, Input, Chart wrappers …
│       ├── features/       one folder per domain: auth, calendar, dashboard,
│       │                   reports, friends, weight, goals, notifications, settings
│       ├── lib/            API client, date helpers, formatting
│       ├── locales/        nl, en, de, fr, pt, it, es (JSON per namespace)
│       └── styles/         design tokens (colours, spacing, typography)
├── server/                 Express + TypeScript + Prisma
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts         default sports + achievement catalogue
│   └── src/
│       ├── config/         env parsing (fails at startup if a variable is missing)
│       ├── middleware/     auth, validation, rate limiting, error handler
│       ├── modules/        one folder per domain, each with
│       │                   routes → controller → service → (Prisma)
│       ├── policies/       who may see what (privacy rules in one place)
│       ├── jobs/           weekly report scheduler, achievement checks
│       ├── storage/        object storage adapter (S3 API)
│       └── app.ts / server.ts
├── shared/                 Zod schemas + TypeScript types used by both sides
├── docs/
└── package.json            workspaces + root scripts
```

**Why feature folders instead of "all components / all pages":** every feature (calendar, friends, weight …) has its own components, API calls and pages together. Adding a feature means adding a folder, not editing ten places.

**Why a `shared` package:** the same Zod schema validates a training session form in the browser _and_ the request on the server. The rules cannot drift apart, and TypeScript types come for free.

## 3. How frontend, backend and database communicate

```
Browser (React)
   │  fetch /api/v1/...  (JSON, httpOnly session cookie sent automatically)
   ▼
Express
   ├─ helmet, CORS (same origin), rate limiter
   ├─ requireAuth        → reads cookie, loads user  (401 if missing)
   ├─ validate(zodSchema)→ rejects bad input          (400)
   ├─ controller         → HTTP in/out only
   ├─ service            → business rules + policies   (403/404)
   └─ Prisma Client      → SQL
   ▼
MySQL (Railway)

Images: Express ⇄ S3-compatible bucket (private). The browser never gets bucket credentials.
```

- **REST API, versioned under `/api/v1`.** Resources such as `/sessions`, `/sports`, `/stats?from=&to=`, `/reports/:weekStart`, `/friends`, `/users/:username`, `/weights`, `/goals`, `/notifications`, `/me/settings`.
- **TanStack Query** on the frontend handles caching, loading and error states, and refetching after a change (e.g. after saving a session, the calendar and dashboard update).
- **The server never returns Prisma objects directly.** Every response goes through a mapper that picks the allowed fields (`toOwnerSession`, `toFriendSession`). A private field cannot leak because someone forgot to remove it: it is simply never selected.
- **Statistics are computed on the server** with SQL aggregation (`SUM(duration)`, `GROUP BY sport`), not by downloading every session to the browser.

## 4. Authentication

- Passwords hashed with **argon2id**.
- Login creates a random session token. The browser gets it as an **httpOnly, Secure, SameSite=Lax cookie**; the database stores only a SHA-256 hash of it (`AuthSession` table). Logout or "log out everywhere" deletes the row, which takes effect immediately; a stateless JWT could not be revoked that way.
- Login, registration and password reset are rate-limited.
- Password reset: single-use token (hashed in DB, valid 30 minutes) sent by email. All sessions are revoked after a reset.

## 5. Authorisation and privacy

Two rules, enforced on the server:

1. **Owner data is always queried with the logged-in user's id**, never an id from the request: `where: { id: params.id, userId: req.user.id }`. Changing an id in the URL to someone else's session returns 404 (not 403, so you can't tell it exists).
2. **Viewing another user's data goes through `policies/`.** `canView(viewer, owner, resource)` checks the friendship status plus the owner's privacy settings, and the friend mappers only select public fields.

| Data                                                 | Owner | Friends                                                               | Others                       |
| ---------------------------------------------------- | ----- | --------------------------------------------------------------------- | ---------------------------- |
| Date, sport, duration, weekly hours                  | ✓     | if activity sharing on (default **on**)                               | ✗                            |
| Streaks, achievements                                | ✓     | if sharing on (default **on**)                                        | ✗                            |
| Reflection ("why it went badly"), motivation, rating | ✓     | only per session when the user shares it explicitly (default **off**) | ✗                            |
| Weekly report / dashboard                            | ✓     | if dashboard sharing on (default **off**)                             | ✗                            |
| Weight, height, evidence photos                      | ✓     | never by default                                                      | ✗                            |
| Username, first name, avatar                         | ✓     | ✓                                                                     | only if "discoverable" is on |

Automated tests try to reach each private resource as a stranger, as a friend and as a pending friend (`server/src/modules/social/social.test.ts`). Every response to another user is also scanned for private values (email, height, personal goals, private reflections).

Implementation: `server/src/policies/relationship.ts` is the only place that decides what a viewer may see (`getRelation`, `canSeeBasics`, `sharedSections`). Responses for other users are built from `social/mappers.ts`, which only selects public fields; private columns are never read for them. A friend's weekly report shows its numbers and goal results only, never the highlights (which contain reflections).

## 6. File uploads (profile pictures, weighing-scale evidence)

1. Upload via `multipart/form-data` to Express (multer, in memory, max 8 MB).
2. Check the real file type from the file's bytes (JPEG, PNG or WebP), not the file name. iPhones convert HEIC photos to JPEG when uploading them in the browser.
3. **Re-encode with `sharp`.** This removes EXIF metadata, including GPS location, which is often in phone photos taken at home.
4. Store in a **private** bucket under a random key (`evidence/<userId>/<uuid>.webp`).
5. To view, the client calls `/api/v1/weights/:id/evidence`; the server checks ownership and streams the photo itself with `Cache-Control: private, no-store`. (Decided during phase 6 instead of presigned URLs: the bucket never hands out any URL, and the browser never caches the photo.)
6. A file that looks like an image but can't be decoded is refused with 415, the same as any other non-image.
7. A weight entry can't be edited: value and photo belong together. A wrong entry is deleted (with its photo) and added again.

A weight entry and its evidence are created in one request: no photo means no weight entry. If the database write fails, the uploaded object is deleted again.

## 7. Weekly reports

- Each user has an IANA timezone (e.g. `Europe/Amsterdam`), detected in the browser at registration and changeable in settings.
- Weeks run Monday 00:00 to Sunday 23:59 local time.
- A scheduler in the server runs **every 15 minutes** and finds users for whom it is now Sunday ≥ 18:00 locally and who have no report for this week yet. For each one it computes the report, stores it, and creates a "report ready" notification.
- `UNIQUE(userId, weekStart)` makes generation idempotent: a double run or a restart can't create duplicates. If the server was down on Sunday evening, the next run catches up.
- The report stores a **snapshot** (stats, goal results, comparison) so old reports don't change when sessions or goals are edited later.
- Conclusions are **rule-based**, not AI-generated: e.g. "punctuality rose from 60% to 90%" only when there's data for both weeks; reasons are quoted only from what the user wrote. With too little data the report says so.
- Implementation: `server/src/modules/stats/metrics.ts` (pure statistics: totals, goals, streaks, consistency, series), `reports/build.ts` (report content and conclusion rules), `reports/generate.ts` (due-week logic per timezone and idempotent creation). The scheduler runs it every 15 minutes, so a report appears between 18:00 and 18:15.
- When a report is created, a `WEEKLY_REPORT` notification is stored (and `GOAL_ACHIEVED` when goals were reached), respecting the user's notification settings. The notification centre itself follows in phase 6; until then the dashboard shows a banner for an unread report.
- `npm run report:generate -w server -- <email> [weekStart]` creates a report immediately (development and support).
- Transactions that can collide (account deletion, report creation) are retried after a MySQL deadlock.

## 8. Internationalisation

- `react-i18next`, one JSON file per language and feature namespace, loaded on demand.
- The language is saved in `UserPreferences` and also applied before login (browser language).
- Text generated by the server (notifications, report conclusions) is stored as a **translation key + parameters**, e.g. `{ key: "report.hoursUp", params: { now: 12, prev: 9 } }`. So when the user switches language, old reports and notifications switch too.
- Dates and numbers are formatted with `Intl` per locale.

## 9. Design system

- Tailwind with design tokens as CSS variables, so light/dark mode and text size (S/M/L) are a class on `<html>`; no component needs to know about them.
- Palette: navy `#0B1220`, charcoal `#161B26`, surface/white, one accent (electric blue) plus status colours for good/average/poor. A fixed muted colour per sport for the calendar.
- Typography: Inter (UI) with tabular numbers for statistics.
- Charts with Recharts: bar (hours per week), donut (hours per sport), line (weight, consistency).
- Animations only on state changes (150–200 ms) and respecting `prefers-reduced-motion`.

## 10. Deployment on Railway

Recommended setup: **one app service + MySQL + bucket**.

| Railway service | Role                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------- |
| `pace-app`      | Express serves `/api/v1` _and_ the built React app (`client/dist`)                        |
| `MySQL`         | Railway MySQL plugin; `DATABASE_URL` injected as a reference variable                     |
| `Bucket`        | Railway Storage Bucket (S3-compatible). Cloudflare R2 or AWS S3 work via the same adapter |

Why one service: frontend and API on the same domain means the session cookie works without cross-site cookie issues or CORS, and there's one deploy. The frontend still has its own build step. Splitting into two services later is possible.

- Live: https://pace-app-production.up.railway.app (service `pace-app`, EU West). Every push to `main` deploys automatically.
- Build: `npm run build` (client + server). Start: `npm start`.
- Pre-deploy command: `npm run db:deploy -w server` (`prisma migrate deploy`). Migrations run before the new version starts; if one fails, the deploy stops.
- Health check: `GET /api/health`, timeout 120 s.
- These settings live on the Railway service itself. Railway retired `railway.json`; moving them into a `.railway/railway.ts` file (Railway's Infrastructure as Code) is an open decision because it adds the `railway` npm package.
- Variables: `DATABASE_URL=${{MySQL.MYSQL_URL}}` (private network, database `railway`), `NODE_ENV=production`, `APP_URL`, `S3_*` for the `pace-uploads` bucket (EU West), `MAIL_FROM`, and `SMTP_*` once a mail account is configured. Production stores files at the bucket root; development uses the `dev/` prefix.
- Secrets (`DATABASE_URL`, `SESSION_SECRET`, `S3_*`, `MAIL_*`) only as Railway variables; `.env.example` in the repo lists their names without values.
- The scheduler runs inside the app service. Keep **one replica** (or add a database lock before scaling out).

## 11. Testing

- **Vitest + Supertest** for API tests against a real MySQL test database (no mocks for data access).
- Dedicated privacy test suite (section 5).
- Unit tests for the tricky logic: streaks, week boundaries/DST, goal evaluation, report conclusions.
- **Playwright** for main user flows and responsive checks (mobile, tablet, desktop).
