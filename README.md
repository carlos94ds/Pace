# PACE – Social Training & Performance Tracker

PACE helps athletes train with more discipline and consistency. It combines a training calendar, a personal performance dashboard, automatic weekly reports and a privacy-first social layer where friends motivate each other.

## Status

**Phase 0 – Planning.** The architecture, database design and roadmap are written down and waiting for approval. No application code yet.

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture, how the frontend, backend and database talk to each other, security model, deployment |
| [docs/DATABASE.md](docs/DATABASE.md) | Proposed MySQL schema (Prisma), relationships, indexes, constraints |
| [docs/CHALLENGES.md](docs/CHALLENGES.md) | Technical challenges and how they will be handled |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Development phases with deliverables and "done when" criteria |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Recharts, react-i18next |
| Backend | Node.js, Express, TypeScript, Zod |
| Database | MySQL 8, Prisma ORM (migrations), MySQL Workbench for inspection |
| File storage | S3-compatible object storage (private bucket) |
| Hosting | Railway (app service + MySQL + bucket) |
