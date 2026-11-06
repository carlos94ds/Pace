import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Not required for `prisma generate` (build step); migrate and the app fail clearly without it.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
