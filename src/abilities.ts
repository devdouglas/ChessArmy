/** Unit specials. Editor-granted; kits don't own them. */

export const ABILITY_IDS = ['hide', 'javelin', 'charge', 'trap'] as const;

export type AbilityId = (typeof ABILITY_IDS)[number];

export const ABILITY_LABEL: Record<AbilityId, string> = {
  hide: 'Hide',
  javelin: 'Javelin',
  charge: 'Charge',
  trap: 'Trap',
};

export const ABILITY_BLURB: Record<AbilityId, string> = {
  hide: 'Hide in forest. Enemies cannot see this unit until it moves, attacks, or is hit.',
  javelin:
    'Switch to a javelin throw. Shows throw range; clicking a target shoots — no melee/shoot picker.',
  charge:
    'Spend unused energy to crash through enemies. Hover shows charge routes. Not legal after energy is spent this round.',
  trap: 'Plant pikes on the hex this unit faces.',
};

export function isAbilityId(raw: unknown): raw is AbilityId {
  return typeof raw === 'string' && (ABILITY_IDS as readonly string[]).includes(raw);
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
