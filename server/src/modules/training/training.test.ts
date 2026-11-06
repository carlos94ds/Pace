import { todayIn, addDays, type TrainingSession } from '@pace/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../lib/prisma';
import { cleanupTestUsers, makeTestApp, registeredAgent } from '../../../test/helpers';

const { app } = makeTestApp();
type Agent = Awaited<ReturnType<typeof registeredAgent>>['agent'];

let builtIn: Record<string, string> = {};

beforeAll(async () => {
  const sports = await prisma.sport.findMany({ where: { ownerId: null } });
  builtIn = Object.fromEntries(sports.map((s) => [s.slug!, s.id]));
});
afterAll(cleanupTestUsers);

const session = (overrides: Record<string, unknown> = {}) => ({
  date: '2026-11-02',
  sportId: builtIn.mma,
  gymId: null,
  durationMinutes: 90,
  punctuality: 'on_time',
  motivation: 4,
  rating: 3,
  intensity: 5,
  reflection: 'Sparring felt sharp',
  shareDetails: false,
  ...overrides,
});

async function create(agent: Agent, overrides: Record<string, unknown> = {}) {
  const res = await agent.post('/api/v1/sessions').send(session(overrides));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as TrainingSession;
}

describe('sessions', () => {
  it('requires a session cookie', async () => {
    await request(app).get('/api/v1/sessions').expect(401);
    await request(app).post('/api/v1/sessions').send(session()).expect(401);
    await request(app).get('/api/v1/stats/summary?from=2026-01-01&to=2026-01-31').expect(401);
  });

  it('creates, reads, updates and deletes a session with all fields', async () => {
    const { agent } = await registeredAgent(app);
    const created = await create(agent);
    expect(created).toMatchObject({
      date: '2026-11-02',
      durationMinutes: 90,
      punctuality: 'on_time',
      motivation: 4,
      rating: 3,
      intensity: 5,
      reflection: 'Sparring felt sharp',
      shareDetails: false,
      gym: null,
    });
    expect(created.sport.slug).toBe('mma');

    // Stored as a plain calendar day: no timezone shift.
    const row = await prisma.trainingSession.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.date.toISOString()).toBe('2026-11-02T00:00:00.000Z');

    const updated = (
      await agent
        .put(`/api/v1/sessions/${created.id}`)
        .send(
          session({
            date: '2026-11-01',
            sportId: builtIn.bjj,
            punctuality: 'late',
            reflection: '  ',
            shareDetails: true,
          }),
        )
        .expect(200)
    ).body as TrainingSession;
    expect(updated).toMatchObject({
      id: created.id,
      date: '2026-11-01',
      punctuality: 'late',
      reflection: null,
      shareDetails: true,
    });
    expect(updated.sport.slug).toBe('bjj');
    expect((await agent.get(`/api/v1/sessions/${created.id}`).expect(200)).body).toEqual(updated);

    await agent.delete(`/api/v1/sessions/${created.id}`).expect(204);
    await agent.get(`/api/v1/sessions/${created.id}`).expect(404);
    expect(await prisma.trainingSession.count({ where: { id: created.id } })).toBe(0);
  });

  it('links a gym', async () => {
    const { agent } = await registeredAgent(app);
    const gym = await prisma.gym.create({ data: { name: `Gym ${Date.now()}`, city: 'Deventer' } });
    const created = await create(agent, { gymId: gym.id });
    expect(created.gym).toEqual({ id: gym.id, name: gym.name, city: 'Deventer' });
    await agent.delete(`/api/v1/sessions/${created.id}`).expect(204);
    await prisma.gym.delete({ where: { id: gym.id } });
  });

  it('rejects invalid input per field', async () => {
    const { agent } = await registeredAgent(app);
    const res = await agent
      .post('/api/v1/sessions')
      .send(
        session({
          date: '2026-02-30',
          durationMinutes: 0,
          motivation: 6,
          rating: 0,
          intensity: 2.5,
          punctuality: 'early',
        }),
      )
      .expect(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual([
      'date',
      'durationMinutes',
      'intensity',
      'motivation',
      'punctuality',
      'rating',
    ]);

    const missing = await agent.post('/api/v1/sessions').send({}).expect(400);
    expect(missing.body.error.fields).toHaveProperty('sportId');
  });

  it("rejects dates after today in the user's own timezone", async () => {
    // Kiritimati is UTC+14: always the latest calendar day on earth.
    const { agent } = await registeredAgent(app, { timezone: 'Pacific/Kiritimati' });
    const today = todayIn('Pacific/Kiritimati');
    await create(agent, { date: today });
    const res = await agent
      .post('/api/v1/sessions')
      .send(session({ date: addDays(today, 1) }))
      .expect(400);
    expect(res.body.error.fields).toEqual({ date: 'in_future' });
  });

  it("rejects another user's custom sport and unknown gyms", async () => {
    const { agent } = await registeredAgent(app);
    const { me: other } = await registeredAgent(app);
    const foreign = await prisma.sport.create({
      data: { name: 'Their sport', color: '#4B5563', ownerId: other.id },
    });
    const res = await agent
      .post('/api/v1/sessions')
      .send(session({ sportId: foreign.id, gymId: crypto.randomUUID() }))
      .expect(400);
    expect(res.body.error.fields).toEqual({ sportId: 'not_found', gymId: 'not_found' });
  });
});

describe("other users' sessions", () => {
  it('are invisible and untouchable (404, never 403)', async () => {
    const { agent: owner } = await registeredAgent(app);
    const { agent: intruder } = await registeredAgent(app);
    const s = await create(owner);

    await intruder.get(`/api/v1/sessions/${s.id}`).expect(404);
    await intruder
      .put(`/api/v1/sessions/${s.id}`)
      .send(session({ durationMinutes: 1 }))
      .expect(404);
    await intruder.delete(`/api/v1/sessions/${s.id}`).expect(404);
    await intruder.get('/api/v1/sessions/not-a-uuid').expect(404);

    expect((await intruder.get('/api/v1/sessions').expect(200)).body.items).toEqual([]);
    expect(
      (await intruder.get('/api/v1/sessions/calendar?from=2026-11-01&to=2026-11-30').expect(200))
        .body,
    ).toEqual([]);
    expect(
      (await intruder.get('/api/v1/stats/summary?from=2026-11-01&to=2026-11-30').expect(200)).body
        .sessions,
    ).toBe(0);
    // Using someone else's session as a page cursor is refused.
    await intruder.get(`/api/v1/sessions?cursor=${s.id}`).expect(400);

    const unchanged = await prisma.trainingSession.findUniqueOrThrow({ where: { id: s.id } });
    expect(unchanged.durationMinutes).toBe(90);
  });
});

describe('history and calendar', () => {
  it('lists newest first with filters and pagination', async () => {
    const { agent } = await registeredAgent(app);
    const dates = ['2026-10-01', '2026-10-05', '2026-10-05', '2026-10-20', '2026-11-03'];
    for (const [i, date] of dates.entries()) {
      await create(agent, {
        date,
        sportId: i % 2 ? builtIn.bjj : builtIn.mma,
        punctuality: i === 3 ? 'late' : 'on_time',
      });
    }

    const page1 = (await agent.get('/api/v1/sessions?limit=2').expect(200)).body;
    expect(page1.items.map((s: TrainingSession) => s.date)).toEqual(['2026-11-03', '2026-10-20']);
    const page2 = (await agent.get(`/api/v1/sessions?limit=2&cursor=${page1.nextCursor}`)).body;
    const page3 = (await agent.get(`/api/v1/sessions?limit=2&cursor=${page2.nextCursor}`)).body;
    expect(page2.items.map((s: TrainingSession) => s.date)).toEqual(['2026-10-05', '2026-10-05']);
    expect(page3.items.map((s: TrainingSession) => s.date)).toEqual(['2026-10-01']);
    expect(page3.nextCursor).toBeNull();
    const allIds = [...page1.items, ...page2.items, ...page3.items].map((s) => s.id);
    expect(new Set(allIds).size).toBe(5);

    const bjj = (await agent.get(`/api/v1/sessions?sportId=${builtIn.bjj}`)).body.items;
    expect(bjj).toHaveLength(2);
    const late = (await agent.get('/api/v1/sessions?punctuality=late')).body.items;
    expect(late.map((s: TrainingSession) => s.date)).toEqual(['2026-10-20']);
    const october = (await agent.get('/api/v1/sessions?from=2026-10-02&to=2026-10-31')).body.items;
    expect(october).toHaveLength(3);

    const calendar = (await agent.get('/api/v1/sessions/calendar?from=2026-10-05&to=2026-10-20'))
      .body;
    expect(calendar.map((s: TrainingSession) => s.date)).toEqual([
      '2026-10-05',
      '2026-10-05',
      '2026-10-20',
    ]);
  });

  it('limits the calendar range and validates queries', async () => {
    const { agent } = await registeredAgent(app);
    await agent.get('/api/v1/sessions/calendar?from=2026-01-01&to=2026-06-01').expect(400);
    await agent.get('/api/v1/sessions/calendar?from=2026-02-01&to=2026-01-01').expect(400);
    await agent.get('/api/v1/sessions?limit=1000').expect(400);
    await agent.get('/api/v1/sessions?punctuality=never').expect(400);
  });
});

describe('statistics', () => {
  it('match the sessions in the database', async () => {
    const { agent, me } = await registeredAgent(app);
    await create(agent, { date: '2026-09-01', durationMinutes: 60, sportId: builtIn.mma });
    await create(agent, { date: '2026-09-01', durationMinutes: 45, sportId: builtIn.running });
    await create(agent, { date: '2026-09-03', durationMinutes: 90, sportId: builtIn.mma });
    await create(agent, { date: '2026-09-30', durationMinutes: 30, sportId: builtIn.running });
    await create(agent, { date: '2026-10-01', durationMinutes: 120, sportId: builtIn.mma }); // outside

    const stats = (await agent.get('/api/v1/stats/summary?from=2026-09-01&to=2026-09-30')).body;
    expect(stats).toMatchObject({ sessions: 4, trainingDays: 3, totalMinutes: 225 });
    expect(
      stats.perSport.map((s: { sport: { slug: string }; minutes: number; sessions: number }) => [
        s.sport.slug,
        s.minutes,
        s.sessions,
      ]),
    ).toEqual([
      ['mma', 150, 2],
      ['running', 75, 2],
    ]);

    // Cross-check against a direct database aggregate.
    const db = await prisma.trainingSession.aggregate({
      where: {
        userId: me.id,
        date: { gte: new Date('2026-09-01T00:00:00Z'), lte: new Date('2026-09-30T00:00:00Z') },
      },
      _sum: { durationMinutes: true },
      _count: true,
    });
    expect(stats.totalMinutes).toBe(db._sum.durationMinutes);
    expect(stats.sessions).toBe(db._count);
  });

  it('are empty without sessions', async () => {
    const { agent } = await registeredAgent(app);
    const stats = (await agent.get('/api/v1/stats/summary?from=2026-09-01&to=2026-09-30')).body;
    expect(stats).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      sessions: 0,
      trainingDays: 0,
      totalMinutes: 0,
      perSport: [],
    });
  });
});

describe('custom sports', () => {
  it('can be created, used, renamed and deleted once unused', async () => {
    const { agent } = await registeredAgent(app);
    const sport = (
      await agent.post('/api/v1/sports').send({ name: 'Sambo', color: '#2F7F9E' }).expect(201)
    ).body;
    expect(sport).toMatchObject({ name: 'Sambo', slug: null, color: '#2F7F9E' });
    const res = await agent.post('/api/v1/sports').send({ name: 'sambo', color: '#2F7F9E' });
    expect(res.status).toBe(409);
    expect(res.body.error.fields).toEqual({ name: 'taken' });

    const s = await create(agent, { sportId: sport.id });
    const renamed = (
      await agent.put(`/api/v1/sports/${sport.id}`).send({ name: 'Combat Sambo', color: '#C2413A' })
    ).body;
    expect(renamed.name).toBe('Combat Sambo');
    expect((await agent.get(`/api/v1/sessions/${s.id}`)).body.sport.name).toBe('Combat Sambo');

    const blocked = await agent.delete(`/api/v1/sports/${sport.id}`).expect(409);
    expect(blocked.body.error.code).toBe('sport_in_use');
    await agent.delete(`/api/v1/sessions/${s.id}`).expect(204);
    await agent.delete(`/api/v1/sports/${sport.id}`).expect(204);
    expect(await prisma.sport.count({ where: { id: sport.id } })).toBe(0);
  });

  it("can't touch built-in sports or another user's sports", async () => {
    const { agent } = await registeredAgent(app);
    const { agent: other } = await registeredAgent(app);
    const theirs = (
      await other.post('/api/v1/sports').send({ name: 'Secret', color: '#4B5563' }).expect(201)
    ).body;
    await agent
      .put(`/api/v1/sports/${theirs.id}`)
      .send({ name: 'Mine', color: '#4B5563' })
      .expect(404);
    await agent.delete(`/api/v1/sports/${theirs.id}`).expect(404);
    await agent
      .put(`/api/v1/sports/${builtIn.mma}`)
      .send({ name: 'X', color: '#4B5563' })
      .expect(400);
    await agent
      .put(`/api/v1/sports/${builtIn.mma}`)
      .send({ name: 'Mixed', color: '#4B5563' })
      .expect(404);
    await agent.delete(`/api/v1/sports/${builtIn.mma}`).expect(404);
    expect((await prisma.sport.findUniqueOrThrow({ where: { id: theirs.id } })).name).toBe(
      'Secret',
    );
    expect((await prisma.sport.findUniqueOrThrow({ where: { id: builtIn.mma } })).name).toBe('MMA');
  });

  it('only accepts colours from the palette', async () => {
    const { agent } = await registeredAgent(app);
    const res = await agent.post('/api/v1/sports').send({ name: 'Padel', color: '#ff00ff' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ color: 'invalid_value' });
  });
});

describe('account deletion', () => {
  it('removes sessions and custom sports, even when sessions use them', async () => {
    const { agent, me, user } = await registeredAgent(app);
    const sport = (
      await agent.post('/api/v1/sports').send({ name: 'Padel', color: '#3B9C4A' }).expect(201)
    ).body;
    await create(agent, { sportId: sport.id });
    await create(agent);
    await agent.delete('/api/v1/me').send({ password: user.password }).expect(204);
    expect(await prisma.trainingSession.count({ where: { userId: me.id } })).toBe(0);
    expect(await prisma.sport.count({ where: { ownerId: me.id } })).toBe(0);
  });
});
