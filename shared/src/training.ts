import { z } from 'zod';
import { isIsoDate } from './dates';
import type { Gym, Sport } from './profile';

/** Earliest date a session can be logged for. */
export const MIN_SESSION_DATE = '2000-01-01';
export const MAX_SESSION_MINUTES = 1440;
export const REFLECTION_MAX = 2000;

export const isoDateSchema = z
  .string()
  .refine(isIsoDate, { message: 'invalid_date' })
  .refine((d) => d >= MIN_SESSION_DATE, { message: 'too_early' });

export const PUNCTUALITIES = ['on_time', 'late'] as const;
export const punctualitySchema = z.enum(PUNCTUALITIES);
export type Punctuality = z.infer<typeof punctualitySchema>;

/** Motivation, rating and intensity all use a 1–5 scale. */
export const scoreSchema = z.number().int().min(1).max(5);
export const SCORES = [1, 2, 3, 4, 5] as const;

export const sessionInputSchema = z.object({
  date: isoDateSchema,
  sportId: z.uuid(),
  gymId: z.uuid().nullable(),
  durationMinutes: z.number().int().min(1).max(MAX_SESSION_MINUTES),
  punctuality: punctualitySchema,
  motivation: scoreSchema,
  rating: scoreSchema,
  intensity: scoreSchema,
  reflection: z
    .string()
    .trim()
    .max(REFLECTION_MAX)
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  shareDetails: z.boolean(),
});
export type SessionInput = z.infer<typeof sessionInputSchema>;

export const sessionListQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  sportId: z.uuid().optional(),
  gymId: z.uuid().optional(),
  punctuality: punctualitySchema.optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const statsQuerySchema = z
  .object({ from: isoDateSchema, to: isoDateSchema })
  .refine((q) => q.from <= q.to, { message: 'invalid_range', path: ['to'] });

/** Muted colours that stay readable in light and dark mode; custom sports pick one. */
export const SPORT_COLORS = [
  '#C2413A',
  '#D97A2B',
  '#B8892F',
  '#3B9C4A',
  '#2E8B6E',
  '#2F7F9E',
  '#3E63B8',
  '#6A4FB3',
  '#A35C8C',
  '#4B5563',
] as const;

export const sportInputSchema = z.object({
  name: z.string().trim().min(2).max(50),
  color: z.enum(SPORT_COLORS),
});
export type SportInput = z.infer<typeof sportInputSchema>;

export interface TrainingSession {
  id: string;
  date: string;
  sport: Sport;
  gym: Gym | null;
  durationMinutes: number;
  punctuality: Punctuality;
  motivation: number;
  rating: number;
  intensity: number;
  reflection: string | null;
  shareDetails: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionPage {
  items: TrainingSession[];
  nextCursor: string | null;
}

export interface TrainingStats {
  from: string;
  to: string;
  sessions: number;
  trainingDays: number;
  totalMinutes: number;
  perSport: { sport: Sport; sessions: number; minutes: number }[];
}
