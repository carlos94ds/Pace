import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../lib/prisma';
import { cleanupTestUsers, makeTestApp, newUser, registeredAgent } from '../../../test/helpers';

const { app, mails } = makeTestApp();

afterAll(cleanupTestUsers);

describe('registration', () => {
  it('creates an account with private-by-default settings and logs in', async () => {
    const { agent, user } = await registeredAgent(app);
    const me = (await agent.get('/api/v1/me').expect(200)).body;

    expect(me.email).toBe(user.email);
    expect(me.profile).toMatchObject({ username: user.username, firstName: 'Test' });
    expect(me.privacy).toEqual({
      discoverable: true,
      profile: 'friends',
      activity: 'friends',
      streaks: 'friends',
      achievements: 'friends',
      dashboard: 'private',
      weight: 'private',
    });
    expect(JSON.stringify(me)).not.toMatch(/passwordHash|argon2/);
  });

  it('stores the password only as an argon2id hash', async () => {
    const { user } = await registeredAgent(app);
    const row = await prisma.user.findUniqueOrThrow({ where: { email: user.email } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.passwordHash).not.toContain(user.password);
  });

  it('rejects a taken email and username per field', async () => {
    const { user } = await registeredAgent(app);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(newUser({ email: user.email.toUpperCase(), username: user.username }));
    expect(res.status).toBe(409);
    expect(res.body.error.fields).toEqual({ email: 'taken', username: 'taken' });
  });

  it('validates input', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(newUser({ password: 'short', username: 'a', timezone: 'Mars/Base' }));
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['password', 'timezone', 'username']);
  });
});

describe('login and logout', () => {
  it('gives the same answer for a wrong password and an unknown email', async () => {
    const { user } = await registeredAgent(app);
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'wrong-password' });
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.pace.invalid', password: 'wrong-password' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('logs in with the right password', async () => {
    const { user } = await registeredAgent(app);
    const agent = request.agent(app);
    await agent
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);
    await agent.get('/api/v1/me').expect(200);
  });

  it('logout ends only this session', async () => {
    const { agent, user } = await registeredAgent(app);
    const other = request.agent(app);
    await other.post('/api/v1/auth/login').send({ email: user.email, password: user.password });

    await agent.post('/api/v1/auth/logout').expect(204);
    await agent.get('/api/v1/me').expect(401);
    await other.get('/api/v1/me').expect(200);
  });

  it('logout-all ends every session', async () => {
    const { agent, user } = await registeredAgent(app);
    const other = request.agent(app);
    await other.post('/api/v1/auth/login').send({ email: user.email, password: user.password });

    await agent.post('/api/v1/auth/logout-all').expect(204);
    await agent.get('/api/v1/me').expect(401);
    await other.get('/api/v1/me').expect(401);
  });
});

describe('password reset', () => {
  const tokenFrom = (text: string) => /token=([\w-]+)/.exec(text)?.[1] ?? '';

  it('resets the password with a single-use emailed token and logs out everywhere', async () => {
    const { agent, user } = await registeredAgent(app);
    mails.length = 0;

    await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email }).expect(204);
    await expect.poll(() => mails.length).toBe(1);
    expect(mails[0]!.to).toBe(user.email);
    const token = tokenFrom(mails[0]!.text);

    const newPassword = 'a-brand-new-password';
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: newPassword })
      .expect(204);
    await agent.get('/api/v1/me').expect(401);

    const reuse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'yet-another-password' });
    expect(reuse.body.error.code).toBe('invalid_token');

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: newPassword })
      .expect(200);
  });

  it('answers the same for unknown emails and sends nothing', async () => {
    mails.length = 0;
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@test.pace.invalid' })
      .expect(204);
    await new Promise((r) => setTimeout(r, 300));
    expect(mails).toHaveLength(0);
  });

  it('stores only a hash of the token', async () => {
    const { user, me } = await registeredAgent(app);
    mails.length = 0;
    await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email });
    await expect.poll(() => mails.length).toBe(1);
    const token = tokenFrom(mails[0]!.text);
    const row = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: me.id } });
    expect(row.tokenHash).not.toBe(token);
  });
});
