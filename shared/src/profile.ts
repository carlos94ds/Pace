import { z } from 'zod';
import { firstNameSchema, timezoneSchema, usernameSchema } from './auth';
import { languageSchema, textSizeSchema, themeSchema } from './preferences';

export const TRAINING_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
  'competitive',
  'professional',
] as const;
export const trainingLevelSchema = z.enum(TRAINING_LEVELS);
export type TrainingLevel = z.infer<typeof trainingLevelSchema>;

export const VISIBILITIES = ['private', 'friends'] as const;
export const visibilitySchema = z.enum(VISIBILITIES);
export type Visibility = z.infer<typeof visibilitySchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable();

export const updateProfileSchema = z
  .object({
    firstName: firstNameSchema,
    username: usernameSchema,
    bio: optionalText(280),
    heightCm: z.number().int().min(80).max(260).nullable(),
    trainingLevel: trainingLevelSchema,
    personalGoals: optionalText(2000),
    timezone: timezoneSchema,
    gymId: z.uuid().nullable(),
    sportIds: z.array(z.uuid()).max(20),
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const NOTIFICATION_KEYS = [
  'friendRequests',
  'friendAccepted',
  'friendMilestones',
  'reactions',
  'weeklyReport',
  'streaks',
  'goals',
] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

export const updatePreferencesSchema = z
  .object({
    language: languageSchema,
    theme: themeSchema,
    textSize: textSizeSchema,
    notifications: z
      .object(
        Object.fromEntries(NOTIFICATION_KEYS.map((k) => [k, z.boolean()])) as Record<
          NotificationKey,
          z.ZodBoolean
        >,
      )
      .partial(),
  })
  .partial();
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export const PRIVACY_KEYS = [
  'profile',
  'activity',
  'streaks',
  'achievements',
  'dashboard',
  'weight',
] as const;
export type PrivacyKey = (typeof PRIVACY_KEYS)[number];

export const updatePrivacySchema = z
  .object({
    discoverable: z.boolean(),
    ...(Object.fromEntries(PRIVACY_KEYS.map((k) => [k, visibilitySchema])) as Record<
      PrivacyKey,
      typeof visibilitySchema
    >),
  })
  .partial();
export type UpdatePrivacyInput = z.infer<typeof updatePrivacySchema>;

export const createGymSchema = z.object({
  name: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
});

export interface Sport {
  id: string;
  slug: string | null;
  name: string;
  color: string;
}

export interface Gym {
  id: string;
  name: string;
  city: string;
}

/** The logged-in user's own account, as returned by GET /me. */
export interface Me {
  id: string;
  email: string;
  createdAt: string;
  profile: {
    username: string;
    firstName: string;
    bio: string | null;
    avatarUrl: string | null;
    heightCm: number | null;
    trainingLevel: TrainingLevel;
    personalGoals: string | null;
    timezone: string;
    gym: Gym | null;
    sports: Sport[];
  };
  preferences: {
    language: z.infer<typeof languageSchema>;
    theme: z.infer<typeof themeSchema>;
    textSize: z.infer<typeof textSizeSchema>;
    notifications: Record<NotificationKey, boolean>;
  };
  privacy: { discoverable: boolean } & Record<PrivacyKey, Visibility>;
}

/** Error body for every failed API request. `fields` maps a form field to an error code. */
export interface ApiErrorBody {
  error: { code: string; fields?: Record<string, string> };
}
