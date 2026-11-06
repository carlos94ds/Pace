import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import {
  EVIDENCE_MAX_BYTES,
  fromUtcDate,
  todayIn,
  toUtcDate,
  weightInputSchema,
  type WeightEntry,
} from '@pace/shared';
import { Router, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { queueFileDeletions, tryProcessFileDeletions } from '../../lib/file-deletions';
import { HttpError } from '../../middleware/errors';
import { currentUserId, requireAuth } from '../../middleware/session';
import { parseBody } from '../../middleware/validate';
import { loadTimezone } from '../stats/load';
import { processEvidence } from './evidence';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: EVIDENCE_MAX_BYTES, files: 1, fields: 5 },
});

const toEntry = (w: {
  id: string;
  weightKg: { toString(): string };
  measuredAt: Date;
  note: string | null;
  createdAt: Date;
}): WeightEntry => ({
  id: w.id,
  measuredOn: fromUtcDate(w.measuredAt),
  weightKg: Number(w.weightKg.toString()),
  note: w.note,
  evidenceUrl: `/api/v1/weights/${w.id}/evidence`,
  createdAt: w.createdAt.toISOString(),
});

function entryId(req: Request) {
  const parsed = z.uuid().safeParse(req.params.id);
  if (!parsed.success) throw new HttpError(404, 'not_found');
  return parsed.data;
}

/**
 * Weight history. Every entry needs a photo of the scale; entry and photo are created
 * together and deleted together. Only the owner can ever see the photos.
 */
export function weightsRouter(ctx: AppContext): Router {
  const router = Router();
  const { prisma, storage } = ctx;
  router.use(requireAuth);

  router.get('/weights', async (req, res) => {
    const rows = await prisma.weightMeasurement.findMany({
      where: { userId: currentUserId(req) },
      orderBy: [{ measuredAt: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
    });
    res.json(rows.map(toEntry));
  });

  router.post('/weights', upload.single('evidence'), async (req, res) => {
    const userId = currentUserId(req);
    // No photo, no entry. Reported together with any other field errors.
    let input;
    try {
      input = parseBody(weightInputSchema, req);
    } catch (err) {
      if (err instanceof HttpError && !req.file) {
        throw new HttpError(400, 'validation_error', { ...err.fields, evidence: 'required' });
      }
      throw err;
    }
    if (!req.file) throw new HttpError(400, 'validation_error', { evidence: 'required' });
    if (input.measuredOn > todayIn(await loadTimezone(prisma, userId))) {
      throw new HttpError(400, 'validation_error', { measuredOn: 'in_future' });
    }
    const { image, sha256 } = await processEvidence(req.file.buffer);

    const key = `evidence/${userId}/${randomUUID()}.webp`;
    await storage.put(key, image, 'image/webp');
    try {
      const row = await prisma.weightMeasurement.create({
        data: {
          userId,
          weightKg: input.weightKg,
          measuredAt: toUtcDate(input.measuredOn),
          note: input.note,
          evidence: {
            create: { storageKey: key, mimeType: 'image/webp', sizeBytes: image.length, sha256 },
          },
        },
      });
      res.status(201).json(toEntry(row));
    } catch (err) {
      // The database refused the entry: don't leave the photo behind.
      await storage.delete(key).catch(() => undefined);
      throw err;
    }
  });

  router.get('/weights/:id/evidence', async (req, res) => {
    const row = await prisma.weightEvidence.findFirst({
      where: { measurementId: entryId(req), measurement: { userId: currentUserId(req) } },
      select: { storageKey: true },
    });
    const file = row && (await storage.get(row.storageKey));
    if (!file) throw new HttpError(404, 'not_found');
    res.setHeader('Content-Type', file.contentType);
    // Sensitive: never stored by the browser or anything in between.
    res.setHeader('Cache-Control', 'private, no-store');
    await pipeline(file.body, res);
  });

  router.delete('/weights/:id', async (req, res) => {
    const id = entryId(req);
    const userId = currentUserId(req);
    const keys = await prisma.$transaction(async (tx) => {
      const row = await tx.weightMeasurement.findFirst({
        where: { id, userId },
        select: { evidence: { select: { storageKey: true } } },
      });
      if (!row) throw new HttpError(404, 'not_found');
      const keys = row.evidence ? [row.evidence.storageKey] : [];
      await queueFileDeletions(tx, keys);
      await tx.weightMeasurement.delete({ where: { id } });
      return keys;
    });
    await tryProcessFileDeletions(ctx, keys);
    res.status(204).end();
  });

  return router;
}
