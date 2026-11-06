import type { NotificationPage } from '@pace/shared';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../lib/prisma';
import { cleanupTestUsers, makeTestApp, registeredAgent } from '../../../test/helpers';
import { pruneNotifications } from './notifications.routes';

const { app } = makeTestApp();
afterAll(cleanupTestUsers);

describe('notifications', () => {
  it('lists, counts and marks notifications as read', async () => {
    const a = await registeredAgent(app);
    const b = await registeredAgent(app);
    await a.agent.post('/api/v1/friends/requests').send({ userId: b.me.id }).expect(201);

    const page = (await b.agent.get('/api/v1/notifications')).body as NotificationPage;
    expect(page.unread).toBe(1);
    expect(page.items[0]).toMatchObject({
      type: 'friend_request',
      key: 'friendRequest',
      link: '/friends?tab=requests',
      readAt: null,
      actor: { id: a.me.id, username: a.user.username },
    });
    expect((await b.agent.get('/api/v1/notifications/unread-count')).body).toEqual({ unread: 1 });

    const after = (
      await b.agent.post('/api/v1/notifications/read').send({ ids: [page.items[0]!.id] })
    ).body;
    expect(after).toEqual({ unread: 0 });
    expect((await b.agent.get('/api/v1/notifications')).body.items[0].readAt).not.toBeNull();
  });

  it('are private to their recipient', async () => {
    const a = await registeredAgent(app);
    const b = await registeredAgent(app);
    const c = await registeredAgent(app);
    await a.agent.post('/api/v1/friends/requests').send({ userId: b.me.id });
    const id = (await b.agent.get('/api/v1/notifications')).body.items[0].id;
    expect((await c.agent.get('/api/v1/notifications')).body.items).toEqual([]);
    await c.agent
      .post('/api/v1/notifications/read')
      .send({ ids: [id] })
      .expect(200);
    expect((await b.agent.get('/api/v1/notifications/unread-count')).body.unread).toBe(1);
    await request(app).get('/api/v1/notifications').expect(401);
  });

  it('marks everything read at once and pages through older ones', async () => {
    const { agent, me } = await registeredAgent(app);
    await prisma.notification.createMany({
      data: Array.from({ length: 35 }, (_, i) => ({
        userId: me.id,
        type: 'WEEKLY_REPORT' as const,
        payload: {
          key: 'weeklyReport',
          params: { weekStart: '2026-10-26' },
          link: '/reports/2026-10-26',
        },
        createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0, i % 2)),
      })),
    });
    const first = (await agent.get('/api/v1/notifications')).body as NotificationPage;
    const second = (await agent.get(`/api/v1/notifications?cursor=${first.nextCursor}`))
      .body as NotificationPage;
    expect(first.items).toHaveLength(30);
    expect(new Set([...first.items, ...second.items].map((n) => n.id)).size).toBe(35);
    expect(first.unread).toBe(35);
    expect((await agent.post('/api/v1/notifications/read').send({})).body).toEqual({ unread: 0 });
  });

  it('drop a request notification when the request is withdrawn', async () => {
    const a = await registeredAgent(app);
    const b = await registeredAgent(app);
    await a.agent.post('/api/v1/friends/requests').send({ userId: b.me.id });
    const { outgoing } = (await a.agent.get('/api/v1/friends/requests')).body;
    await a.agent.delete(`/api/v1/friends/requests/${outgoing[0].requestId}`).expect(204);
    expect((await b.agent.get('/api/v1/notifications')).body.items).toEqual([]);
  });

  it('removes read notifications after 90 days, never unread ones', async () => {
    const { me } = await registeredAgent(app);
    const old = new Date('2026-01-01T00:00:00Z');
    await prisma.notification.createMany({
      data: [
        {
          userId: me.id,
          type: 'WEEKLY_REPORT',
          payload: { key: 'weeklyReport' },
          createdAt: old,
          readAt: old,
        },
        { userId: me.id, type: 'WEEKLY_REPORT', payload: { key: 'weeklyReport' }, createdAt: old },
      ],
    });
    await pruneNotifications(prisma, new Date('2026-11-06T00:00:00Z'));
    const left = await prisma.notification.findMany({ where: { userId: me.id } });
    expect(left).toHaveLength(1);
    expect(left[0]!.readAt).toBeNull();
  });
});
