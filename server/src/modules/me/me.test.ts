import sharp from 'sharp';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../lib/prisma';
import { cleanupTestUsers, makeTestApp, registeredAgent } from '../../../test/helpers';

const { app, storage } = makeTestApp();

afterAll(cleanupTestUsers);

// A small JPEG carrying GPS coordinates, like a photo straight from a phone.
const photoWithGps = () =>
  sharp({ create: { width: 800, height: 600, channels: 3, background: '#3355aa' } })
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '52/1 22/1 0/1' } })
    .toBuffer();

describe('access', () => {
  it('requires a session', async () => {
    await request(app).get('/api/v1/me').expect(401);
    await request(app).patch('/api/v1/me/profile').send({ bio: 'x' }).expect(401);
    await request(app).get('/api/v1/sports').expect(401);
  });
});

describe('profile', () => {
  it('updates profile fields, gym and sports', async () => {
    const { agent } = await registeredAgent(app);
    const sports = (await agent.get('/api/v1/sports').expect(200)).body as {
      id: string;
      slug: string;
    }[];
    const mma = sports.find((s) => s.slug === 'mma')!;
    const bjj = sports.find((s) => s.slug === 'bjj')!;
    const gymName = `Test Gym ${Date.now()}`;
    const gym = (
      await agent.post('/api/v1/gyms').send({ name: gymName, city: 'Zwolle' }).expect(201)
    ).body;
    const gym2 = (
      await agent
        .post('/api/v1/gyms')
        .send({ name: `${gymName} 2`, city: 'Deventer' })
        .expect(201)
    ).body;

    const me = (
      await agent
        .patch('/api/v1/me/profile')
        .send({
          bio: 'Fighter',
          heightCm: 180,
          trainingLevel: 'advanced',
          gymIds: [gym2.id, gym.id],
          sportIds: [mma.id, bjj.id],
        })
        .expect(200)
    ).body;

    expect(me.profile).toMatchObject({ bio: 'Fighter', heightCm: 180, trainingLevel: 'advanced' });
    // Both gyms, in the order the user chose.
    expect(me.profile.gyms).toEqual([gym2, gym]);
    expect(me.profile.sports.map((s: { slug: string }) => s.slug).sort()).toEqual(['bjj', 'mma']);

    const found = (await agent.get(`/api/v1/gyms?q=${gymName.toLowerCase()}`).expect(200)).body;
    expect(found).toContainEqual(gym);
    // Same gym again (different case) is not duplicated.
    const again = (
      await agent.post('/api/v1/gyms').send({ name: gymName.toUpperCase(), city: 'zwolle' })
    ).body;
    expect(again.id).toBe(gym.id);

    // Removing one keeps the other; an unknown gym is rejected.
    const after = (
      await agent
        .patch('/api/v1/me/profile')
        .send({ gymIds: [gym.id] })
        .expect(200)
    ).body;
    expect(after.profile.gyms).toEqual([gym]);
    await agent
      .patch('/api/v1/me/profile')
      .send({ gymIds: [gym.id, '00000000-0000-4000-8000-000000000000'] })
      .expect(400);
    await prisma.gym.deleteMany({ where: { id: { in: [gym.id, gym2.id] } } });
  });

  it("can't link another user's custom sport", async () => {
    const { agent } = await registeredAgent(app);
    const { me: other } = await registeredAgent(app);
    const foreign = await prisma.sport.create({
      data: { name: 'Secret sport', color: '#000000', ownerId: other.id },
    });
    const res = await agent.patch('/api/v1/me/profile').send({ sportIds: [foreign.id] });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ sportIds: 'not_found' });
    expect((await agent.get('/api/v1/sports')).body.map((s: { id: string }) => s.id)).not.toContain(
      foreign.id,
    );
  });

  it('rejects a username that belongs to someone else', async () => {
    const { agent } = await registeredAgent(app);
    const { user: other } = await registeredAgent(app);
    const res = await agent.patch('/api/v1/me/profile').send({ username: other.username });
    expect(res.status).toBe(409);
  });
});

describe('preferences and privacy', () => {
  it('saves preferences and privacy settings', async () => {
    const { agent } = await registeredAgent(app);
    await agent
      .patch('/api/v1/me/preferences')
      .send({
        language: 'nl',
        theme: 'dark',
        textSize: 'large',
        notifications: { reactions: false },
      })
      .expect(200);
    const me = (
      await agent
        .patch('/api/v1/me/privacy')
        .send({ activity: 'private', discoverable: false })
        .expect(200)
    ).body;
    expect(me.preferences).toMatchObject({ language: 'nl', theme: 'dark', textSize: 'large' });
    expect(me.preferences.notifications.reactions).toBe(false);
    expect(me.preferences.notifications.goals).toBe(true);
    expect(me.privacy).toMatchObject({
      activity: 'private',
      discoverable: false,
      weight: 'private',
    });
  });
});

describe('password and email', () => {
  it('changes the password, keeping this session and ending others', async () => {
    const { agent, user } = await registeredAgent(app);
    const other = request.agent(app);
    await other.post('/api/v1/auth/login').send({ email: user.email, password: user.password });

    const wrong = await agent
      .put('/api/v1/me/password')
      .send({ currentPassword: 'not-my-password', newPassword: 'another-password-1' });
    expect(wrong.status).toBe(403);

    await agent
      .put('/api/v1/me/password')
      .send({ currentPassword: user.password, newPassword: 'another-password-1' })
      .expect(204);
    await agent.get('/api/v1/me').expect(200);
    await other.get('/api/v1/me').expect(401);
  });

  it('changes the email only with the password', async () => {
    const { agent, user } = await registeredAgent(app);
    const email = user.email.replace('user-', 'renamed-');
    await agent.put('/api/v1/me/email').send({ email, password: 'wrong-password' }).expect(403);
    const me = (
      await agent.put('/api/v1/me/email').send({ email, password: user.password }).expect(200)
    ).body;
    expect(me.email).toBe(email);
  });
});

describe('avatar', () => {
  it('stores a re-encoded image without metadata, hidden from strangers when not discoverable', async () => {
    const { agent, me } = await registeredAgent(app);
    const updated = (
      await agent
        .post('/api/v1/me/avatar')
        .attach('avatar', await photoWithGps(), 'me.jpg')
        .expect(200)
    ).body;
    expect(updated.profile.avatarUrl).toMatch(new RegExp(`^/api/v1/users/${me.id}/avatar\\?v=`));

    const res = await agent.get(updated.profile.avatarUrl).buffer(true).expect(200);
    expect(res.headers['content-type']).toBe('image/webp');
    const meta = await sharp(res.body as Buffer).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 512, height: 512 });
    expect(meta.exif).toBeUndefined();

    // Who else may see it is covered by the privacy tests in social.test.ts.
    await agent.patch('/api/v1/me/privacy').send({ discoverable: false }).expect(200);
    const { agent: stranger } = await registeredAgent(app);
    await stranger.get(updated.profile.avatarUrl).expect(404);
  });

  it('rejects files that are not images, whatever their name', async () => {
    const { agent } = await registeredAgent(app);
    const res = await agent
      .post('/api/v1/me/avatar')
      .attach('avatar', Buffer.from('<?php echo "hi"; ?>'), 'photo.jpg');
    expect(res.status).toBe(415);
  });

  it('deletes the old file when replaced or removed', async () => {
    const { agent, me } = await registeredAgent(app);
    const ownFiles = () => [...storage.files.keys()].filter((k) => k.includes(me.id));

    await agent
      .post('/api/v1/me/avatar')
      .attach('avatar', await photoWithGps(), 'a.jpg')
      .expect(200);
    const first = ownFiles();
    await agent
      .post('/api/v1/me/avatar')
      .attach('avatar', await photoWithGps(), 'b.jpg')
      .expect(200);
    expect(ownFiles()).toHaveLength(1);
    expect(ownFiles()).not.toEqual(first);

    await agent.delete('/api/v1/me/avatar').expect(200);
    expect(ownFiles()).toHaveLength(0);
  });
});

describe('account deletion', () => {
  it('needs the password, then removes all data and files', async () => {
    const { agent, user, me } = await registeredAgent(app);
    await agent
      .post('/api/v1/me/avatar')
      .attach('avatar', await photoWithGps(), 'a.jpg')
      .expect(200);

    await agent.delete('/api/v1/me').send({ password: 'wrong-password' }).expect(403);
    await agent.delete('/api/v1/me').send({ password: user.password }).expect(204);

    expect(await prisma.user.findUnique({ where: { id: me.id } })).toBeNull();
    expect(await prisma.userProfile.findUnique({ where: { userId: me.id } })).toBeNull();
    expect(await prisma.authSession.count({ where: { userId: me.id } })).toBe(0);
    expect([...storage.files.keys()].some((k) => k.includes(me.id))).toBe(false);
    await agent.get('/api/v1/me').expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(401);
  });
});
