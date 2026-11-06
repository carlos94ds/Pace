import { z } from 'zod';

// Lowercase codes match the i18n locale files; the database stores them uppercase.
export const LANGUAGES = ['nl', 'en', 'de', 'fr', 'pt', 'it', 'es'] as const;
export const languageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof languageSchema>;

export const THEMES = ['light', 'dark', 'system'] as const;
export const themeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof themeSchema>;

export const TEXT_SIZES = ['small', 'medium', 'large'] as const;
export const textSizeSchema = z.enum(TEXT_SIZES);
export type TextSize = z.infer<typeof textSizeSchema>;
