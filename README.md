# PACE – Social Training & Performance Tracker

PACE helps athletes train with more discipline and consistency. It combines a training calendar, a personal performance dashboard, automatic weekly reports and a privacy-first social layer where friends motivate each other.

## Status

**Phase 1 – Foundation: done.** Monorepo, design system, 7 languages, Express API with health check, full database schema migrated on Railway MySQL. Next: phase 2 (accounts and profiles).

## Getting started

Requirements: Node.js 24+ and access to the Railway project.

```bash
npm install
cp server/.env.example server/.env   # fill in DATABASE_URL (see the comment in the file)
npm run db:migrate                   # apply migrations to the development database
npm run db:seed                      # built-in sports and achievements
npm run dev                          # client on http://localhost:5173, API on :3000
```

| Command                              | What it does                                    |
| ------------------------------------ | ----------------------------------------------- |
| `npm run dev`                        | Client and API with hot reload                  |
| `npm test`                           | Unit and API tests                              |
| `npm run lint` / `npm run typecheck` | Code checks                                     |
| `npm run build` && `npm start`       | Production build, served by Express on one port |
| `npm run db:studio`                  | Browse the database (or use MySQL Workbench)    |

Deployment: every push to `main` deploys to Railway (https://pace-app-production.up.railway.app), with `prisma migrate deploy` before each release and a health check on `/api/health`. Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#10-deployment-on-railway).

| Document                                     | Contents                                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture, how the frontend, backend and database talk to each other, security model, deployment |
| [docs/DATABASE.md](docs/DATABASE.md)         | Proposed MySQL schema (Prisma), relationships, indexes, constraints                                 |
| [docs/CHALLENGES.md](docs/CHALLENGES.md)     | Technical challenges and how they will be handled                                                   |
| [docs/ROADMAP.md](docs/ROADMAP.md)           | Development phases with deliverables and "done when" criteria                                       |

## Tech stack

| Layer        | Technology                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------- |
| Frontend     | React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Recharts, react-i18next |
| Backend      | Node.js, Express, TypeScript, Zod                                                            |
| Database     | MySQL 8, Prisma ORM (migrations), MySQL Workbench for inspection                             |
| File storage | S3-compatible object storage (private bucket)                                                |
| Hosting      | Railway (app service + MySQL + bucket)                                                       |
