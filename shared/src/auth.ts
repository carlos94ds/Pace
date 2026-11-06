import { z } from 'zod';
import { languageSchema } from './preferences';

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(191));

export const PASSWORD_MIN = 10;
export const passwordSchema = z.string().min(PASSWORD_MIN).max(128);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_][a-z0-9._]{2,29}$/);

export const firstNameSchema = z.string().trim().min(1).max(60);

export const timezoneSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: firstNameSchema,
  username: usernameSchema,
  timezone: timezoneSchema,
  language: languageSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const changeEmailSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
});
