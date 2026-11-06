import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pino } from 'pino';
import request from 'supertest';
import { createApp } from '../src/app';
import type { AppContext } from '../src/context';
import type { Mail } from '../src/lib/mailer';
import { prisma } from '../src/lib/prisma';
import type { Storage } from '../src/lib/storage';

/** In-memory stand-in for the bucket, so tests can check which files exist. */
export class MemoryStorage implements Storage {
  readonly files = new Map<string, { body: Buffer; contentType: string }>();
  async put(key: string, body: Buffer, contentType: string) {
    this.files.set(key, { body, contentType });
  }
  async get(key: string) {
    const file = this.files.get(key);
    return file ? { body: Readable.from(file.body), contentType: file.contentType } : null;
  }
  async delete(key: string) {
    this.files.delete(key);
  }
}

export function makeTestApp() {
  const storage = new MemoryStorage();
  const mails: Mail[] = [];
  const ctx: AppContext = {
    prisma,
    storage,
    mailer: { send: async (mail) => void mails.push(mail) },
    logger: pino({ level: 'silent' }),
    config: { appUrl: 'http://localhost:5173', production: false },
  };
  const app = createApp(ctx, {
    checkDatabase: async () => true,
    version: 'test',
    authRateLimit: 10_000,
    clientDist: '/nonexistent',
  });
  return { app, ctx, storage, mails };
}

export const TEST_EMAIL_DOMAIN = '@test.pace.invalid';

export function newUser(overrides: Record<string, unknown> = {}) {
  const id = randomUUID().slice(0, 8);
  return {
    email: `user-${id}${TEST_EMAIL_DOMAIN}`,
    password: 'correct-horse-battery',
    firstName: 'Test',
    username: `user_${id}`,
    timezone: 'Europe/Amsterdam',
    language: 'en',
    ...overrides,
  };
}

/** Registers a user and returns a supertest agent that keeps its session cookie. */
export async function registeredAgent(app: Parameters<typeof request.agent>[0], overrides = {}) {
  const agent = request.agent(app);
  const user = newUser(overrides);
  const res = await agent.post('/api/v1/auth/register').send(user).expect(201);
  return { agent, user, me: res.body as { id: string } };
}

export async function cleanupTestUsers() {
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
}
