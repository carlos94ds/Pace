import type { Sport } from '@pace/shared';
import type { TFunction } from 'i18next';

/** Built-in sports are translated; custom sports keep the name their owner gave them. */
export function sportName(t: TFunction, sport: Pick<Sport, 'slug' | 'name'>) {
  return sport.slug ? t(`sports.${sport.slug}`, { defaultValue: sport.name }) : sport.name;
}
