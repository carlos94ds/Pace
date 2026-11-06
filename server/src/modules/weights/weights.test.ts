import { addDays, todayIn, type UserProfileView, type WeightEntry } from '@pace/shared';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../lib/prisma';
import { cleanupTestUsers, makeTestApp, registeredAgent } from '../../../test/helpers';

const { app, storage } = makeTestApp();
afterAll(cleanupTestUsers);

const scalePhoto = () =>
  sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#dddddd' } })
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '52/1 30/1 0/1' } })
    .toBuffer();

type Agent = Awaited<ReturnType<typeof registeredAgent>>['agent'];
const addWeight = async (agent: Agent, fields: Record<string, string>, photo?: Buffer) => {
  let req = agent.post('/api/v1/weights');
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  if (photo) req = req.attach('evidence', photo, 'scale.jpg');
  return req;
};

describe('weights', () => {
  it('requires a photo of the scale', async () => {
    const { agent, me } = await registeredAgent(app);
    const res = await addWeight(agent, { weightKg: '80.4', measuredOn: '2026-11-01' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ evidence: 'required' });
    // Field errors and the missing photo are reported together.
    const both = await addWeight(agent, { weightKg: '5', measuredOn: '2026-11-01' });
    expect(both.body.error.fields).toEqual({ weightKg: 'too_small', evidence: 'required' });
    expect(await prisma.weightMeasurement.count({ where: { userId: me.id } })).toBe(0);
  });

  it('stores entry and photo together; the photo is re-encoded without location data', async () => {
    const { agent, me } = await registeredAgent(app);
    const res = await addWeight(
      agent,
      { weightKg: '80.44', measuredOn: '2026-11-01', note: 'morning' },
      await scalePhoto(),
    );
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const entry = res.body as WeightEntry;
    expect(entry).toMatchObject({ measuredOn: '2026-11-01', weightKg: 80.4, note: 'morning' });

    const evidence = await prisma.weightEvidence.findUniqueOrThrow({
      where: { measurementId: entry.id },
    });
    expect(evidence.storageKey).toMatch(new RegExp(`^evidence/${me.id}/`));
    const photo = await agent.get(entry.evidenceUrl).buffer(true).expect(200);
    expect(photo.headers['cache-control']).toBe('private, no-store');
    const meta = await sharp(photo.body as Buffer).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 2048, height: 1365 });
    expect(meta.exif).toBeUndefined();

    expect((await agent.get('/api/v1/weights')).body).toEqual([entry]);
  });

  it('rejects non-images, future dates and impossible weights', async () => {
    const { agent, me } = await registeredAgent(app);
    const fake = await addWeight(
      agent,
      { weightKg: '80', measuredOn: '2026-11-01' },
      Buffer.from('not an image'),
    );
    expect(fake.status).toBe(415);
    // A valid PNG header with damaged pixel data: recognised as PNG, but can't be decoded.
    const damaged = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR42mN8//8/AwMDEwMDAwMDAwAkBgMBwgV7RQAAAABJRU5ErkJggg==',
      'base64',
    );
    const broken = await addWeight(agent, { weightKg: '80', measuredOn: '2026-11-01' }, damaged);
    expect(broken.status).toBe(415);
    const avatar = await agent.post('/api/v1/me/avatar').attach('avatar', damaged, 'a.png');
    expect(avatar.status).toBe(415);
    const tomorrow = addDays(todayIn('Europe/Amsterdam'), 2);
    const future = await addWeight(
      agent,
      { weightKg: '80', measuredOn: tomorrow },
      await scalePhoto(),
    );
    expect(future.body.error.fields).toEqual({ measuredOn: 'in_future' });
    const heavy = await addWeight(
      agent,
      { weightKg: '999', measuredOn: '2026-11-01' },
      await scalePhoto(),
    );
    expect(heavy.body.error.fields).toEqual({ weightKg: 'too_big' });
    // Nothing was stored for the refused uploads.
    expect([...storage.files.keys()].filter((k) => k.includes(me.id))).toEqual([]);
  });

  it('deletes entry and photo together', async () => {
    const { agent, me } = await registeredAgent(app);
    const entry = (
      await addWeight(agent, { weightKg: '75', measuredOn: '2026-10-01' }, await scalePhoto())
    ).body;
    const key = (
      await prisma.weightEvidence.findUniqueOrThrow({ where: { measurementId: entry.id } })
    ).storageKey;
    expect(storage.files.has(key)).toBe(true);
    await agent.delete(`/api/v1/weights/${entry.id}`).expect(204);
    expect(storage.files.has(key)).toBe(false);
    expect(await prisma.weightMeasurement.count({ where: { userId: me.id } })).toBe(0);
    await agent.get(entry.evidenceUrl).expect(404);
  });

  it('removes all photos when the account is deleted', async () => {
    const { agent, me, user } = await registeredAgent(app);
    await addWeight(agent, { weightKg: '75', measuredOn: '2026-10-01' }, await scalePhoto());
    await addWeight(agent, { weightKg: '74', measuredOn: '2026-10-08' }, await scalePhoto());
    expect([...storage.files.keys()].filter((k) => k.includes(me.id))).toHaveLength(2);
    await agent.delete('/api/v1/me').send({ password: user.password }).expect(204);
    expect([...storage.files.keys()].filter((k) => k.includes(me.id))).toHaveLength(0);
  });
});

describe('weight privacy', () => {
  it('is never visible to others by default, and photos never at all', async () => {
    const owner = await registeredAgent(app);
    const friend = await registeredAgent(app);
    const stranger = await registeredAgent(app);
    await owner.agent.post('/api/v1/friends/requests').send({ userId: friend.me.id });
    const { incoming } = (await friend.agent.get('/api/v1/friends/requests')).body;
    await friend.agent.post(`/api/v1/friends/requests/${incoming[0].requestId}/accept`).expect(204);
    const entry = (
      await addWeight(
        owner.agent,
        { weightKg: '82.5', measuredOn: '2026-10-01', note: 'SECRET-NOTE' },
        await scalePhoto(),
      )
    ).body as WeightEntry;

    const profile = async (viewer: typeof friend) =>
      (await viewer.agent.get(`/api/v1/users/by-username/${owner.user.username}`))
        .body as UserProfileView;
    expect((await profile(friend)).weight).toBeNull();
    expect(JSON.stringify(await profile(friend))).not.toContain('82.5');

    for (const viewer of [friend, stranger]) {
      await viewer.agent.get(entry.evidenceUrl).expect(404);
      await viewer.agent.delete(`/api/v1/weights/${entry.id}`).expect(404);
      expect((await viewer.agent.get('/api/v1/weights')).body).toEqual([]);
    }
    await request(app).get(entry.evidenceUrl).expect(401);

    // Shared on purpose: friends see the values only.
    await owner.agent.patch('/api/v1/me/privacy').send({ weight: 'friends' });
    const shared = await profile(friend);
    expect(shared.weight).toEqual([{ measuredOn: '2026-10-01', weightKg: 82.5 }]);
    expect(JSON.stringify(shared)).not.toContain('SECRET-NOTE');
    expect(JSON.stringify(shared)).not.toContain('evidence');
    await friend.agent.get(entry.evidenceUrl).expect(404);
    expect((await profile(stranger)).weight).toBeNull();
  });
});
