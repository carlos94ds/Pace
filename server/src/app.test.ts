import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp, type AppOptions } from './app';
import { makeTestApp } from '../test/helpers';

function makeApp(options: Partial<AppOptions> = {}) {
  const { ctx } = makeTestApp();
  return createApp(ctx, {
    checkDatabase: async () => true,
    version: 'test',
    clientDist: '/nonexistent',
    ...options,
  });
}

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    const res = await request(makeApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up', version: 'test' });
  });

  it('returns 503 when the database is down', async () => {
    const res = await request(makeApp({ checkDatabase: async () => false })).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', database: 'down' });
  });
});

describe('unknown routes', () => {
  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await request(makeApp()).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'not_found' } });
  });

  it('serves index.html for client-side routes when the client is built', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'pace-client-'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>PACE</title>');
    const res = await request(makeApp({ clientDist: dist })).get('/calendar');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>PACE</title>');
  });

  it('still returns JSON 404 for API routes when the client is built', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'pace-client-'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html>');
    const res = await request(makeApp({ clientDist: dist })).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });
});

describe('cross-site requests', () => {
  it('rejects state-changing requests from another origin', async () => {
    const res = await request(makeApp())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'a@b.nl', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('cross_origin');
  });
});

describe('same-origin check', () => {
  it('accepts requests from the configured app URL (development proxy)', async () => {
    const res = await request(makeApp())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({});
    expect(res.status).toBe(400);
  });
});
