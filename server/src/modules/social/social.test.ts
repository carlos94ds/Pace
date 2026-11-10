import { toUtcDate, type FeedPage, type UserProfileView } from '@pace/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../lib/prisma';
import { cleanupTestUsers, makeTestApp, registeredAgent } from '../../../test/helpers';
import { generateReport } from '../reports/generate';

const { app, ctx } = makeTestApp();
type User = Awaited<ReturnType<typeof registeredAgent>>;
let mma = '';

beforeAll(async () => {
  mma = (await prisma.sport.findFirstOrThrow({ where: { slug: 'mma' } })).id;
});
afterAll(cleanupTestUsers);

const session = (o: Record<string, unknown> = {}) => ({
  date: '2026-10-20',
  sportId: mma,
  gymId: null,
  durationMinutes: 60,
  punctuality: 'on_time',
  rating: 1,
  energy: 2,
  injured: false,
  reflection: null,
  shareDetails: false,
  ...o,
});

async function befriend(a: User, b: User) {
  await a.agent.post('/api/v1/friends/requests').send({ userId: b.me.id }).expect(201);
  const { incoming } = (await b.agent.get('/api/v1/friends/requests')).body;
  const req = incoming.find((r: { id: string }) => r.id === a.me.id);
  await b.agent.post(`/api/v1/friends/requests/${req.requestId}/accept`).expect(204);
}

const profileOf = async (viewer: User, owner: User) =>
  viewer.agent.get(`/api/v1/users/by-username/${owner.user.username}`);

describe('friend requests', () => {
  it('can be sent, accepted, and the friendship removed', async () => {
    const a = await registeredAgent(app);
    const b = await registeredAgent(app);
    const sent = (
      await a.agent.post('/api/v1/friends/requests').send({ userId: b.me.id }).expect(201)
    ).body;
    expect(sent).toMatchObject({ id: b.me.id, relation: 'outgoing' });
    expect(Object.keys(sent).sort()).toEqual([
      'avatarUrl',
      'firstName',
      'id',
      'relation',
      'requestId',
      'username',
    ]);

    const requests = (await b.agent.get('/api/v1/friends/requests')).body;
    expect(requests.incoming).toHaveLength(1);
    expect(requests.incoming[0]).toMatchObject({ id: a.me.id, relation: 'incoming' });
    expect(
      await prisma.notification.count({ where: { userId: b.me.id, type: 'FRIEND_REQUEST' } }),
    ).toBe(1);

    // Only the addressee can accept.
    await a.agent.post(`/api/v1/friends/requests/${sent.requestId}/accept`).expect(404);
    await b.agent.post(`/api/v1/friends/requests/${sent.requestId}/accept`).expect(204);
    expect(
      await prisma.notification.count({ where: { userId: a.me.id, type: 'FRIEND_ACCEPTED' } }),
    ).toBe(1);
    expect((await a.agent.get('/api/v1/friends')).body.map((f: { id: string }) => f.id)).toEqual([
      b.me.id,
    ]);
    await a.agent.post('/api/v1/friends/requests').send({ userId: b.me.id }).expect(409);

    await b.agent.delete(`/api/v1/friends/${a.me.id}`).expect(204);
    expect((await a.agent.get('/api/v1/friends')).body).toEqual([]);
  });

  it('keeps a declined request looking pending to its sender', async () => {
    const a = await registeredAgent(app);
    const b = await registeredAgent(app);
    const { requestId } = (await a.agent.post('/api/v1/friends/requests').send({ userId: b.me.id }))
      .body;
    await b.agent.post(`/api/v1/friends/requests/${requestId}/decline`).expect(204);
    expect((await a.agent.get('/api/v1/friends/requests')).body.outgoing).toHaveLength(1);
    expect((await profileOf(a, b)).body.user.relation).toBe('outgoing');
    expect((await b.agent.get('/api/v1/friends/requests')).body.incoming).toEqual([]);
    // Sending again changes nothing and doesn't notify again.
    await a.agent.post('/api/v1/friends/requests').send({ userId: b.me.id }).expect(200);
    expect(
      await prisma.notification.count({ where: { userId: b.me.id, type: 'FRIEND_REQUEST' } }),
    ).toBe(1);
    // The sender can withdraw it.
    await a.agent.delete(`/api/v1/friends/requests/${requestId}`).expect(204);
    expect((await a.agent.get('/api/v1/friends/requests')).body.outgoing).toEqual([]);
  });

  it('accepts when both people ask each other', async () => {
    const a = await registeredAgent(app);
    const b = await registeredAgent(app);
    await a.agent.post('/api/v1/friends/requests').send({ userId: b.me.id }).expect(201);
    const res = await b.agent
      .post('/api/v1/friends/requests')
      .send({ userId: a.me.id })
      .expect(200);
    expect(res.body.relation).toBe('friends');
  });

  it("can't reach users who aren't discoverable, or yourself", async () => {
    const a = await registeredAgent(app);
    const hidden = await registeredAgent(app);
    await hidden.agent.patch('/api/v1/me/privacy').send({ discoverable: false }).expect(200);
    await a.agent.post('/api/v1/friends/requests').send({ userId: hidden.me.id }).expect(404);
    await a.agent.post('/api/v1/friends/requests').send({ userId: a.me.id }).expect(400);
    await request(app).get('/api/v1/friends').expect(401);
  });
});

describe('search and suggestions', () => {
  it('finds discoverable users by username or first name, with public fields only', async () => {
    const a = await registeredAgent(app);
    const b = await registeredAgent(app, { firstName: 'Zebulon' });
    const hidden = await registeredAgent(app, { firstName: 'Zebulon' });
    await hidden.agent.patch('/api/v1/me/privacy').send({ discoverable: false });

    const byName = (await a.agent.get('/api/v1/users/search?q=zebul')).body as { id: string }[];
    expect(byName.map((u) => u.id)).toContain(b.me.id);
    expect(byName.map((u) => u.id)).not.toContain(hidden.me.id);
    const byUsername = (await a.agent.get(`/api/v1/users/search?q=@${b.user.username}`)).body;
    expect(byUsername).toEqual([
      {
        id: b.me.id,
        username: b.user.username,
        firstName: 'Zebulon',
        avatarUrl: null,
        relation: 'none',
        requestId: null,
      },
    ]);
    // Someone who sent you a request is findable even when not discoverable.
    await hidden.agent.post('/api/v1/friends/requests').send({ userId: a.me.id }).expect(201);
    expect(
      (await a.agent.get('/api/v1/users/search?q=zebul')).body.map((u: { id: string }) => u.id),
    ).toContain(hidden.me.id);
    await a.agent.get('/api/v1/users/search?q=z').expect(400);
  });

  it('suggests friends of friends, never connected or hidden users', async () => {
    const me = await registeredAgent(app);
    const friend = await registeredAgent(app);
    const theirFriend = await registeredAgent(app);
    const hiddenFriend = await registeredAgent(app);
    await befriend(me, friend);
    await befriend(friend, theirFriend);
    await befriend(friend, hiddenFriend);
    await hiddenFriend.agent.patch('/api/v1/me/privacy').send({ discoverable: false });

    const suggestions = (await me.agent.get('/api/v1/friends/suggestions')).body as {
      id: string;
      mutualFriends: number;
    }[];
    expect(suggestions.find((s) => s.id === theirFriend.me.id)).toMatchObject({ mutualFriends: 1 });
    const ids = suggestions.map((s) => s.id);
    expect(ids).not.toContain(hiddenFriend.me.id);
    expect(ids).not.toContain(friend.me.id);
    expect(ids).not.toContain(me.me.id);
  });
});

describe('privacy', () => {
  let owner: User;
  let friend: User;
  let pending: User;
  let stranger: User;
  let sharedId = '';
  let privateId = '';
  const SECRET = 'secret reason nobody may read';
  const SHARED = 'shared reason';

  beforeAll(async () => {
    owner = await registeredAgent(app);
    friend = await registeredAgent(app);
    pending = await registeredAgent(app);
    stranger = await registeredAgent(app);
    await owner.agent
      .patch('/api/v1/me/profile')
      .send({ bio: 'Fighter', heightCm: 187, personalGoals: 'GOALS-TEXT' });
    sharedId = (
      await owner.agent.post('/api/v1/sessions').send(
        session({
          reflection: SHARED,
          shareDetails: true,
          injured: true,
          injuryNote: 'private injury note',
        }),
      )
    ).body.id;
    privateId = (
      await owner.agent
        .post('/api/v1/sessions')
        .send(session({ date: '2026-10-21', reflection: SECRET }))
    ).body.id;
    await owner.agent
      .post('/api/v1/goals')
      .send({ type: 'training_days', target: 1, sportId: null });
    await generateReport(ctx, owner.me.id, '2026-10-19', 'Europe/Amsterdam');
    await befriend(owner, friend);
    await pending.agent.post('/api/v1/friends/requests').send({ userId: owner.me.id }).expect(201);
  });

  /** Nothing private may ever appear anywhere in a response to someone else. */
  const expectNoSecrets = (body: unknown) => {
    const json = JSON.stringify(body);
    for (const secret of [
      SECRET,
      'GOALS-TEXT',
      owner.user.email,
      '187',
      'passwordHash',
      'heightCm',
      'personalGoals',
    ]) {
      expect(json).not.toContain(secret);
    }
  };

  it('shows strangers and pending requests only username, first name and photo', async () => {
    for (const viewer of [stranger, pending]) {
      const view = (await profileOf(viewer, owner).then((r) => r.body)) as UserProfileView;
      expect(view.user.id).toBe(owner.me.id);
      expect([view.profile, view.activity, view.streaks, view.achievements, view.report]).toEqual([
        null,
        null,
        null,
        null,
        null,
      ]);
      expectNoSecrets(view);
      expect((await viewer.agent.get('/api/v1/feed')).body.items).toEqual([]);
      await viewer.agent
        .put('/api/v1/reactions')
        .send({ targetType: 'session', targetId: sharedId, type: 'respect' })
        .expect(404);
    }
  });

  it('hides non-discoverable users from strangers entirely, but not from pending requests', async () => {
    await owner.agent.patch('/api/v1/me/privacy').send({ discoverable: false });
    await (
      await profileOf(stranger, owner)
    ).statusCode;
    expect((await profileOf(stranger, owner)).status).toBe(404);
    expect((await profileOf(pending, owner)).status).toBe(200);
    await owner.agent.patch('/api/v1/me/privacy').send({ discoverable: true });
  });

  it('shows friends the default sections, with details only for shared sessions', async () => {
    const res = await profileOf(friend, owner);
    const view = res.body as UserProfileView;
    expect(view.user.relation).toBe('friends');
    expect(view.profile).toMatchObject({ bio: 'Fighter' });
    expect(view.report).toBeNull(); // weekly report is private by default
    const recent = view.activity!.recent;
    expect(recent.find((s) => s.id === sharedId)!.details).toMatchObject({
      reflection: SHARED,
      rating: 1,
      energy: 2,
    });
    // Injuries stay private, even on a session whose details are shared.
    expect(JSON.stringify(view)).not.toContain('private injury note');
    expect(JSON.stringify(view)).not.toContain('injur');
    expect(recent.find((s) => s.id === privateId)!.details).toBeNull();
    expect(view.streaks).toEqual({ current: expect.any(Number), longest: expect.any(Number) });
    expect(view.achievements!.map((a) => a.code)).toContain('FIRST_SESSION');
    expectNoSecrets(view);

    const feed = (await friend.agent.get('/api/v1/feed')).body as FeedPage;
    expect(
      feed.items
        .filter((i) => i.kind === 'session')
        .map((i) => i.id)
        .sort(),
    ).toEqual([sharedId, privateId].sort());
    expectNoSecrets(feed);
  });

  it('follows each privacy setting separately', async () => {
    await owner.agent.patch('/api/v1/me/privacy').send({
      activity: 'private',
      achievements: 'private',
      streaks: 'private',
      profile: 'private',
    });
    const view = (await profileOf(friend, owner)).body as UserProfileView;
    expect([view.profile, view.activity, view.streaks, view.achievements]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect((await friend.agent.get('/api/v1/feed')).body.items).toEqual([]);
    await friend.agent
      .put('/api/v1/reactions')
      .send({ targetType: 'session', targetId: sharedId, type: 'respect' })
      .expect(404);

    await owner.agent.patch('/api/v1/me/privacy').send({ dashboard: 'friends' });
    const withReport = (await profileOf(friend, owner)).body as UserProfileView;
    expect(withReport.report).toMatchObject({
      weekStart: '2026-10-19',
      sessions: 2,
      trainingDays: 2,
    });
    expect(JSON.stringify(withReport)).not.toContain(SHARED); // report highlights stay private
    expectNoSecrets(withReport);

    await owner.agent.patch('/api/v1/me/privacy').send({
      activity: 'friends',
      achievements: 'friends',
      streaks: 'friends',
      profile: 'friends',
      dashboard: 'private',
    });
  });

  it('shows avatars only to people who may see the user', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    const me = (await owner.agent.post('/api/v1/me/avatar').attach('avatar', png, 'a.png')).body;
    const url = me.profile.avatarUrl as string;
    await friend.agent.get(url).expect(200);
    await stranger.agent.get(url).expect(200); // discoverable
    await owner.agent.patch('/api/v1/me/privacy').send({ discoverable: false });
    await stranger.agent.get(url).expect(404);
    await pending.agent.get(url).expect(200);
    await friend.agent.get(url).expect(200);
    await owner.agent.patch('/api/v1/me/privacy').send({ discoverable: true });
  });

  it('ends all access when the friendship ends', async () => {
    const other = await registeredAgent(app);
    await befriend(owner, other);
    expect((await profileOf(other, owner)).body.activity).not.toBeNull();
    await owner.agent.delete(`/api/v1/friends/${other.me.id}`).expect(204);
    const view = (await profileOf(other, owner)).body as UserProfileView;
    expect(view.activity).toBeNull();
    expect((await other.agent.get('/api/v1/feed')).body.items).toEqual([]);
  });
});

describe('reactions', () => {
  it('can be given once per type, notify the owner once, and be taken back', async () => {
    const owner = await registeredAgent(app);
    const friend = await registeredAgent(app);
    await befriend(owner, friend);
    const s = (await owner.agent.post('/api/v1/sessions').send(session())).body;
    const body = { targetType: 'session', targetId: s.id, type: 'respect' };

    await friend.agent.put('/api/v1/reactions').send(body).expect(200);
    const again = (await friend.agent.put('/api/v1/reactions').send(body).expect(200)).body;
    expect(again).toEqual({
      counts: { respect: 1, well_done: 0, keep_going: 0 },
      mine: ['respect'],
    });
    expect(
      await prisma.notification.count({ where: { userId: owner.me.id, type: 'REACTION' } }),
    ).toBe(1);
    await owner.agent.put('/api/v1/reactions').send(body).expect(404); // not on your own

    const removed = (
      await friend.agent.delete(`/api/v1/reactions/session/${s.id}/respect`).expect(200)
    ).body;
    expect(removed.counts.respect).toBe(0);

    await friend.agent.put('/api/v1/reactions').send({ ...body, type: 'keep_going' });
    await owner.agent.delete(`/api/v1/sessions/${s.id}`).expect(204);
    expect(await prisma.reaction.count({ where: { targetId: s.id } })).toBe(0);
  });

  it('work on achievements', async () => {
    const owner = await registeredAgent(app);
    const friend = await registeredAgent(app);
    await befriend(owner, friend);
    await owner.agent.post('/api/v1/sessions').send(session());
    const feed = (await friend.agent.get('/api/v1/feed')).body as FeedPage;
    const achievement = feed.items.find((i) => i.kind === 'achievement')!;
    expect(achievement).toMatchObject({ code: 'FIRST_SESSION', user: { id: owner.me.id } });
    const summary = (
      await friend.agent
        .put('/api/v1/reactions')
        .send({ targetType: 'achievement', targetId: achievement.id, type: 'well_done' })
        .expect(200)
    ).body;
    expect(summary.counts.well_done).toBe(1);
    const mine = (await owner.agent.get('/api/v1/achievements')).body;
    expect(mine.recent[0].reactions.counts.well_done).toBe(1);
  });
});

describe('feed', () => {
  it('pages through friends’ activity newest first without gaps', async () => {
    const me = await registeredAgent(app);
    const friend = await registeredAgent(app);
    await befriend(me, friend);
    await prisma.trainingSession.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        userId: friend.me.id,
        sportId: mma,
        date: toUtcDate('2026-09-01'),
        durationMinutes: 30 + i,
        punctuality: 'ON_TIME' as const,
        motivation: 3,
        rating: 3,
        intensity: 3,
        createdAt: new Date(Date.UTC(2026, 8, 1, 12, 0, i % 3)), // shared timestamps on purpose
      })),
    });
    const first = (await me.agent.get('/api/v1/feed')).body as FeedPage;
    const second = (await me.agent.get(`/api/v1/feed?cursor=${first.nextCursor}`)).body as FeedPage;
    expect(first.items).toHaveLength(20);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(25);
    await me.agent.get('/api/v1/feed?cursor=nonsense').expect(400);
  });
});

describe('achievements', () => {
  it('are awarded from training data, with notifications for streaks and friends', async () => {
    const owner = await registeredAgent(app);
    const friend = await registeredAgent(app);
    await befriend(owner, friend);
    await prisma.weeklyGoal.create({
      data: {
        userId: owner.me.id,
        type: 'TRAINING_DAYS',
        target: 1,
        createdAt: new Date('2026-09-01T10:00:00Z'),
      },
    });
    // Three weeks in a row with a training day, the last one with 20 hours.
    for (const date of ['2026-10-05', '2026-10-12'])
      await owner.agent.post('/api/v1/sessions').send(session({ date })).expect(201);
    for (const date of ['2026-10-19', '2026-10-20']) {
      await owner.agent
        .post('/api/v1/sessions')
        .send(session({ date, durationMinutes: 600 }))
        .expect(201);
    }
    const mine = (await owner.agent.get('/api/v1/achievements')).body;
    const earned = Object.fromEntries(
      mine.catalogue.map((c: { code: string; earned: number }) => [c.code, c.earned]),
    );
    expect(earned).toMatchObject({
      FIRST_SESSION: 1,
      STREAK_3W: 1,
      WEEK_20H: 1,
      TOTAL_100H: 0,
      STREAK_7W: 0,
    });

    expect(
      await prisma.notification.count({ where: { userId: owner.me.id, type: 'STREAK_MILESTONE' } }),
    ).toBe(1);
    const toFriend = await prisma.notification.findMany({
      where: { userId: friend.me.id, type: 'FRIEND_ACHIEVEMENT' },
    });
    expect(
      toFriend.map((n) => (n.payload as { params: { code: string } }).params.code).sort(),
    ).toEqual(expect.arrayContaining(['FIRST_SESSION', 'STREAK_3W', 'WEEK_20H']));
    // Saving again doesn't award or notify twice.
    await owner.agent
      .post('/api/v1/sessions')
      .send(session({ date: '2026-10-21' }))
      .expect(201);
    expect(
      await prisma.notification.count({ where: { userId: owner.me.id, type: 'STREAK_MILESTONE' } }),
    ).toBe(1);
  });

  it("don't notify friends when achievements are private", async () => {
    const owner = await registeredAgent(app);
    const friend = await registeredAgent(app);
    await befriend(owner, friend);
    await owner.agent.patch('/api/v1/me/privacy').send({ achievements: 'private' });
    await owner.agent.post('/api/v1/sessions').send(session()).expect(201);
    expect(
      await prisma.notification.count({
        where: { userId: friend.me.id, type: 'FRIEND_ACHIEVEMENT' },
      }),
    ).toBe(0);
  });
});

describe('account deletion', () => {
  it('removes notifications others received about the user', async () => {
    const a = await registeredAgent(app);
    const b = await registeredAgent(app);
    await a.agent.post('/api/v1/friends/requests').send({ userId: b.me.id });
    expect(await prisma.notification.count({ where: { userId: b.me.id, actorId: a.me.id } })).toBe(
      1,
    );
    await a.agent.delete('/api/v1/me').send({ password: a.user.password }).expect(204);
    expect(await prisma.notification.count({ where: { actorId: a.me.id } })).toBe(0);
    expect((await b.agent.get('/api/v1/friends/requests')).body.incoming).toEqual([]);
  });
});
