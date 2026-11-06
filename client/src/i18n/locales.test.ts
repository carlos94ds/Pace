import { LANGUAGES } from '@pace/shared';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Tree = { [key: string]: string | Tree };

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

function load(lng: string): Tree {
  return JSON.parse(
    readFileSync(new URL(`../locales/${lng}/common.json`, import.meta.url), 'utf8'),
  );
}

describe('translations', () => {
  const reference = keys(load('en')).sort();

  it.each(LANGUAGES)('%s has exactly the same keys as English', (lng) => {
    expect(keys(load(lng)).sort()).toEqual(reference);
  });
});
