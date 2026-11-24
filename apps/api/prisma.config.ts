import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.cjs',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/zandogo?schema=public',
  },
});
