import { z } from 'zod';
import type { GoalResult } from './goals';
import type { Sport } from './profile';
import { isoDateSchema } from './training';

export const dashboardQuerySchema = z
  .object({ from: isoDateSchema, to: isoDateSchema })
  .refine((q) => q.from <= q.to, { message: 'invalid_range', path: ['to'] });

export type Bucket = 'day' | 'week' | 'month';

export interface PeriodTotals {
  sessions: number;
  trainingDays: number;
  totalMinutes: number;
  /** Rounded minutes; null without sessions. */
  averageMinutes: number | null;
  onTime: number;
  late: number;
  /** 0–100; null without sessions. */
  punctualityPct: number | null;
  /** Averages on the 1–5 scales, one decimal; null without sessions. */
  averageMotivation: number | null;
  averageRating: number | null;
  averageIntensity: number | null;
  perSport: { sport: Sport; sessions: number; minutes: number }[];
}

export interface Streaks {
  /** Weeks in a row reaching the training-day goal. Null without a day goal. */
  current: number | null;
  longest: number | null;
  dayGoal: number | null;
}

export interface Consistency {
  /** 0–100, or null when there's nothing to measure yet. */
  pct: number | null;
  /** 'weeks': share of weeks reaching the day goal; 'days': training days per day. */
  basis: 'weeks' | 'days';
  achieved: number;
  total: number;
}

export interface Dashboard {
  from: string;
  to: string;
  totals: PeriodTotals;
  consistency: Consistency;
  streaks: Streaks;
  bucket: Bucket;
  series: { start: string; minutes: number; sessions: number }[];
  /** This week's progress towards the active goals, whatever period is selected. */
  goals: { weekStart: string; results: GoalResult[] };
}
