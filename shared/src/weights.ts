import { z } from 'zod';
import { isoDateSchema } from './training';

export const WEIGHT_MIN = 20;
export const WEIGHT_MAX = 400;
// Same limit as profile pictures, so one "too large" message fits both.
export const EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;

/** Sent as multipart form fields next to the optional photo, so numbers arrive as text. */
export const weightInputSchema = z.object({
  weightKg: z.coerce
    .number()
    .min(WEIGHT_MIN)
    .max(WEIGHT_MAX)
    // One decimal is what a bathroom scale shows.
    .transform((v) => Math.round(v * 10) / 10),
  measuredOn: isoDateSchema,
  note: z
    .string()
    .trim()
    .max(280)
    .optional()
    .transform((v) => (v ? v : null)),
});
export type WeightInput = z.input<typeof weightInputSchema>;

export interface WeightEntry {
  id: string;
  measuredOn: string;
  weightKg: number;
  note: string | null;
  /** Only ever returned to the owner; null when no photo was added. */
  evidenceUrl: string | null;
  createdAt: string;
}

/** What friends see when the owner shares weight: values only, never photos or notes. */
export interface SharedWeight {
  measuredOn: string;
  weightKg: number;
}
