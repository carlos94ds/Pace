import { toUtcDate, type Dashboard, type Goal } from '@pace/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../lib/prisma';
import { cleanupTestUsers, makeTestApp, registeredAgent } from '../../../test/helpers';
import { generateReport } from '../reports/generate';

const { app, ctx } = makeTestApp();
let sport: Record<string, string> = {};
beforeAll(async () => {
  const rows = await prisma.sport.findMany({ where: { ownerId: null } });
  sport = Object.fromEntries(rows.map((s) => [s.slug!, s.id]));
});
afterAll(cleanupTestUsers);

describe('goals', () => {
  it('can be created, changed and deleted, keeping history', async () => {
    const { agent, me } = await registeredAgent(app);
    const days = (
      await agent
        .post('/api/v1/goals')
        .send({ type: 'training_days', target: 5, sportId: null })
        .expect(201)
    ).body as Goal;
    await agent
      .post('/api/v1/goals')
      .send({ type: 'sport_sessions', target: 3, sportId: sport.mma })
      .expect(201);
    // A second sport goal for another sport is fine; a duplicate type isn't.
    await agent
      .post('/api/v1/goals')
      .send({ type: 'sport_sessions', target: 2, sportId: sport.bjj })
      .expect(201);
    const dup = await agent
      .post('/api/v1/goals')
      .send({ type: 'training_days', target: 4, sportId: null })
      .expect(409);
    expect(dup.body.error.fields).toEqual({ type: 'taken' });

    const changed = (
      await agent
        .put(`/api/v1/goals/${days.id}`)
        .send({ type: 'training_days', target: 4, sportId: null })
        .expect(200)
    ).body as Goal;
    expect(changed.id).not.toBe(days.id);
    const active = (await agent.get('/api/v1/goals')).body as Goal[];
    expect(active.map((g) => [g.type, g.target, g.sport?.slug ?? null])).toEqual([
      ['sport_sessions', 3, 'mma'],
      ['sport_sessions', 2, 'bjj'],
      ['training_days', 4, null],
    ]);
    await agent.delete(`/api/v1/goals/${changed.id}`).expect(204);
    expect((await agent.get('/api/v1/goals')).body).toHaveLength(2);
    // Archived versions stay in the database for past weeks.
    expect(await prisma.weeklyGoal.count({ where: { userId: me.id } })).toBe(4);
  });

  it('validates targets and sports', async () => {
    const { agent } = await registeredAgent(app);
    const send = (body: object) => agent.post('/api/v1/goals').send(body).expect(400);
    expect(
      (await send({ type: 'training_days', target: 8, sportId: null })).body.error.fields,
    ).toEqual({ target: 'too_big' });
    expect(
      (await send({ type: 'punctuality_pct', target: 0, sportId: null })).body.error.fields,
    ).toEqual({ target: 'too_small' });
    expect(
      (await send({ type: 'sport_sessions', target: 2, sportId: null })).body.error.fields,
    ).toEqual({ sportId: 'required' });
    expect(
      (await send({ type: 'total_minutes', target: 600, sportId: sport.mma })).body.error.fields,
    ).toEqual({ sportId: 'not_allowed' });
  });

  it('are private to their owner', async () => {
    const { agent: owner } = await registeredAgent(app);
    const { agent: other } = await registeredAgent(app);
    const goal = (
      await owner.post('/api/v1/goals').send({ type: 'training_days', target: 3, sportId: null })
    ).body as Goal;
    await other
      .put(`/api/v1/goals/${goal.id}`)
      .send({ type: 'training_days', target: 1, sportId: null })
      .expect(404);
    await other.delete(`/api/v1/goals/${goal.id}`).expect(404);
    expect((await other.get('/api/v1/goals')).body).toEqual([]);
    await request(app).get('/api/v1/goals').expect(401);
  });
});

describe('dashboard', () => {
  it('computes all metrics from the database', async () => {
    const { agent, me } = await registeredAgent(app, { timezone: 'Europe/Amsterdam' });
    const add = (date: string, minutes: number, sportId: string, late = false, rating = 3) =>
      prisma.trainingSession.create({
        data: {
          userId: me.id,
          sportId,
          date: toUtcDate(date),
          durationMinutes: minutes,
          punctuality: late ? 'LATE' : 'ON_TIME',
          motivation: 3,
          rating,
          intensity: 3,
        },
      });
    // September 2026: weeks of 7, 14 and 21 Sep reach 3 days; 28 Sep doesn't.
    for (const d of ['2026-09-07', '2026-09-08', '2026-09-09']) await add(d, 60, sport.mma!);
    for (const d of ['2026-09-14', '2026-09-15', '2026-09-16']) await add(d, 90, sport.bjj!);
    await add('2026-09-16', 30, sport.running!, true);
    for (const d of ['2026-09-21', '2026-09-23', '2026-09-25']) await add(d, 60, sport.mma!);
    await add('2026-09-29', 60, sport.mma!, true);
    await prisma.weeklyGoal.create({
      data: {
        userId: me.id,
        type: 'TRAINING_DAYS',
        target: 3,
        createdAt: new Date('2026-09-01T10:00:00Z'),
      },
    });

    const d = (await agent.get('/api/v1/stats/dashboard?from=2026-09-01&to=2026-09-30').expect(200))
      .body as Dashboard;
    expect(d.totals).toMatchObject({
      sessions: 11,
      trainingDays: 10,
      totalMinutes: 3 * 60 + 3 * 90 + 30 + 3 * 60 + 60,
      averageMinutes: 65,
      onTime: 9,
      late: 2,
      punctualityPct: 82,
    });
    expect(d.totals.perSport.map((p) => [p.sport.slug, p.minutes])).toEqual([
      ['mma', 420],
      ['bjj', 270],
      ['running', 30],
    ]);
    // Weeks starting 31 Aug .. 28 Sep: 3 of 5 reached the goal.
    expect(d.consistency).toEqual({ pct: 60, basis: 'weeks', achieved: 3, total: 5 });
    expect(d.streaks).toMatchObject({ longest: 3, dayGoal: 3 });
    expect(d.bucket).toBe('day');
    expect(d.series).toHaveLength(30);
    expect(d.series.find((p) => p.start === '2026-09-16')).toEqual({
      start: '2026-09-16',
      minutes: 120,
      sessions: 2,
    });
    expect(d.goals.results).toEqual([
      expect.objectContaining({ type: 'training_days', target: 3, achieved: expect.any(Boolean) }),
    ]);

    const year = (await agent.get('/api/v1/stats/dashboard?from=2026-01-01&to=2026-12-31'))
      .body as Dashboard;
    expect(year.bucket).toBe('month');
    expect(year.series.find((p) => p.start === '2026-09-01')!.minutes).toBe(d.totals.totalMinutes);
  });

  it("never includes another user's data", async () => {
    const { agent, me } = await registeredAgent(app);
    const { agent: other } = await registeredAgent(app);
    await prisma.trainingSession.create({
      data: {
        userId: me.id,
        sportId: sport.mma!,
        date: toUtcDate('2026-09-01'),
        durationMinutes: 60,
        punctuality: 'ON_TIME',
        motivation: 3,
        rating: 3,
        intensity: 3,
      },
    });
    expect(
      ((await agent.get('/api/v1/stats/dashboard?from=2026-09-01&to=2026-09-30')).body as Dashboard)
        .totals.sessions,
    ).toBe(1);
    expect(
      ((await other.get('/api/v1/stats/dashboard?from=2026-09-01&to=2026-09-30')).body as Dashboard)
        .totals.sessions,
    ).toBe(0);
    await agent.get('/api/v1/stats/dashboard?from=2026-09-30&to=2026-09-01').expect(400);
    await request(app).get('/api/v1/stats/dashboard?from=2026-09-01&to=2026-09-30').expect(401);
  });
});

describe('reports', () => {
  it('are listed and opened by their owner only, and marked as viewed', async () => {
    const { agent, me } = await registeredAgent(app);
    const { agent: other } = await registeredAgent(app);
    await generateReport(ctx, me.id, '2026-10-26', 'Europe/Amsterdam');

    const list = (await agent.get('/api/v1/reports').expect(200)).body;
    expect(list).toEqual([
      expect.objectContaining({ weekStart: '2026-10-26', viewedAt: null, sessions: 0 }),
    ]);
    const report = (await agent.get('/api/v1/reports/2026-10-26').expect(200)).body;
    expect(report).toMatchObject({
      weekStart: '2026-10-26',
      weekEnd: '2026-11-01',
      timezone: 'Europe/Amsterdam',
    });
    expect(report.viewedAt).not.toBeNull();
    expect(report.conclusion.summary).toEqual([{ key: 'noTraining' }]);

    expect((await other.get('/api/v1/reports')).body).toEqual([]);
    await other.get('/api/v1/reports/2026-10-26').expect(404);
    await agent.get('/api/v1/reports/not-a-date').expect(404);
    await agent.get('/api/v1/reports/2026-10-19').expect(404);
  });
});
