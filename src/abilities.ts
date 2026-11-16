/** Unit specials. Editor-granted; kits don't own them. */

export const ABILITY_IDS = [
  'hide',
  'javelin',
  'charge',
  'trap',
  'shields',
  'bash',
  'berserk',
] as const;

export type AbilityId = (typeof ABILITY_IDS)[number];

export const ABILITY_LABEL: Record<AbilityId, string> = {
  hide: 'Hide',
  javelin: 'Javelin',
  charge: 'Charge',
  trap: 'Trap',
  shields: 'Shields up',
  bash: 'Bash',
  berserk: 'Berserk',
};

export const ABILITY_BLURB: Record<AbilityId, string> = {
  hide: 'Hide in forest. Enemies cannot see this unit until it moves, attacks, or is hit. Stepping onto forest again hides it.',
  javelin:
    'Switch to a javelin throw. Shows throw range; clicking a target shoots — no melee/shoot picker.',
  charge:
    'Crash through enemies along the charge paths. A crash inside the normal move spends nothing and shows no AP mark. A destination past that move shows the normal AP bolt and spends 1 when you pick it. With no AP left, that tile shows the crossed bolt instead. No icon on the piece in play. Hopping over a unit still deals charge damage. No walk-to orders.',
  trap: 'Pick an adjacent hex this unit could step toward. Red faces are not spots. Plants hidden pikes (enemies cannot see them), or clears them if already there. Immune to pikes — walking onto them clears the trap. Can spend AP as a second action.',
  shields:
    'Ranged attacks do nothing until this side\'s next turn. Ends this activation — leftover AP cannot be spent.',
  bash:
    'Push every enemy on a green face (armor 0) one hex straight back. Hitting a unit damages both (this unit’s melee, minimum 1, armor applies). A wall or ground they cannot step onto damages the pushed unit. A palisade, tree, or forest deals 1 to both — positive armor soaks that 1, negative armor does not add.',
  berserk:
    'Melee every enemy on a non-red face. Same damage as this unit’s melee, armor applies, and negative armor adds. A red face is skipped.',
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
