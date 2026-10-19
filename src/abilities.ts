/** Catalog of unit abilities. Kits don't own these — the editor (and later effects) do. */

export const ABILITY_IDS = ['general'] as const;

export type AbilityId = (typeof ABILITY_IDS)[number];

export const ABILITY_LABEL: Record<AbilityId, string> = {
  general: 'General',
};

export const ABILITY_BLURB: Record<AbilityId, string> = {
  general: 'Command. Every general on a side must fall — killing one of several does not end the battle.',
};

export function isAbilityId(raw: unknown): raw is AbilityId {
  return raw === 'general';
}

export function sanitizeAbilities(raw: unknown, fallback: readonly AbilityId[] = []): AbilityId[] {
  const src = Array.isArray(raw) ? raw : fallback;
  const out: AbilityId[] = [];
  for (const a of src) {
    if (isAbilityId(a) && !out.includes(a)) out.push(a);
  }
  return out;
}

export function abilitiesEqual(a: readonly AbilityId[], b: readonly AbilityId[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}
