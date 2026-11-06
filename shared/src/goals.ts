import { z } from 'zod';
import type { Sport } from './profile';

export const GOAL_TYPES = [
  'total_minutes',
  'training_days',
  'punctuality_pct',
  'sport_sessions',
] as const;
export const goalTypeSchema = z.enum(GOAL_TYPES);
export type GoalType = z.infer<typeof goalTypeSchema>;

/** Allowed targets per goal type. Hours are entered in the UI and stored as minutes. */
export const GOAL_LIMITS: Record<GoalType, { min: number; max: number }> = {
  total_minutes: { min: 30, max: 100 * 60 },
  training_days: { min: 1, max: 7 },
  punctuality_pct: { min: 1, max: 100 },
  sport_sessions: { min: 1, max: 21 },
};

export const goalInputSchema = z
  .object({
    type: goalTypeSchema,
    target: z.number().int(),
    sportId: z.uuid().nullable(),
  })
  .superRefine((goal, ctx) => {
    const { min, max } = GOAL_LIMITS[goal.type];
    if (goal.target < min) ctx.addIssue({ code: 'custom', path: ['target'], message: 'too_small' });
    if (goal.target > max) ctx.addIssue({ code: 'custom', path: ['target'], message: 'too_big' });
    if (goal.type === 'sport_sessions' && !goal.sportId)
      ctx.addIssue({ code: 'custom', path: ['sportId'], message: 'required' });
    if (goal.type !== 'sport_sessions' && goal.sportId)
      ctx.addIssue({ code: 'custom', path: ['sportId'], message: 'not_allowed' });
  });
export type GoalInput = z.infer<typeof goalInputSchema>;

export interface Goal {
  id: string;
  type: GoalType;
  target: number;
  sport: Sport | null;
  createdAt: string;
}

/** A goal measured against one week. */
export interface GoalResult {
  type: GoalType;
  target: number;
  sport: Sport | null;
  actual: number;
  achieved: boolean;
}
