/** Unit specials. Editor-granted; kits don't own them. */

export const ABILITY_IDS = [
  'hide',
  'javelin',
  'charge',
  'lunge',
  'build',
  'shields',
  'bash',
  'berserk',
] as const;

export type AbilityId = (typeof ABILITY_IDS)[number];

/** What Build can place, or Remove for any buildable token. */
export const BUILD_STRUCTURES = ['pikes', 'palisade', 'bridge', 'remove'] as const;
export type BuildStructure = (typeof BUILD_STRUCTURES)[number];

export const BUILD_STRUCTURE_LABEL: Record<BuildStructure, string> = {
  pikes: 'Trap',
  palisade: 'Palisade',
  bridge: 'Bridge',
  remove: 'Remove',
};

export const BUILD_STRUCTURE_BLURB: Record<BuildStructure, string> = {
  pikes:
    'Hidden pikes. Enemies cannot see them and take damage walking in. Build units are immune but do not clear them by walking over — use Remove.',
  palisade:
    'Wooden fence, 3 HP. Blocks walk and charge (unless the hit breaks it). Arch shots go over; straight shots do not. Use Remove to dismantle.',
  bridge:
    'Planks on an adjacent water hex. Units walk it like land — no swim, no water upkeep. Use Remove to dismantle.',
  remove:
    'Clear an adjacent trap, palisade, or bridge. Trees and forest stay. Red faces are not spots.',
};

export const ABILITY_LABEL: Record<AbilityId, string> = {
  hide: 'Hide',
  javelin: 'Javelin',
  charge: 'Charge',
  lunge: 'Lunge',
  build: 'Build',
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
  lunge:
    'Thrust two hexes in a straight line. Hits both tiles. Damage is melee (Attack + stacks); kits with 0 melee still thrust for 1 (+ Attack). Far-hex kill: stay put — otherwise step to the far hex when empty. Also a promotion for archers and other zero-melee kits.',
  build:
    'Pick Trap, Palisade, Bridge, or Remove, then an adjacent hex (red faces are not spots). Trap/Palisade place on empty ground. Bridge places on empty water. Remove clears any adjacent trap, palisade, or bridge. Immune to pikes — walking onto them does not clear them. Can spend AP as a second action.',
  shields:
    'Until this side\'s next turn: invisible to enemies but still aimable. The first ranged hit that turn reveals them and they stop being a ranged target (later shots cannot lock them). Hits deal no damage while shields are up. Ends this activation — leftover AP cannot be spent.',
  bash:
    'Push every enemy on a green face (armor 0) one hex straight back. Hitting a unit damages both (this unit’s melee, minimum 1, armor applies). A wall or ground they cannot step onto damages the pushed unit. A palisade, tree, or forest deals 1 to both — positive armor soaks that 1, negative armor does not add.',
  berserk:
    'Melee every enemy on a non-red face. Same damage as this unit’s melee, armor applies, and negative armor adds. A red face is skipped.',
};

export function isAbilityId(raw: unknown): raw is AbilityId {
  return typeof raw === 'string' && (ABILITY_IDS as readonly string[]).includes(raw);
}

export function isBuildStructure(raw: unknown): raw is BuildStructure {
  return typeof raw === 'string' && (BUILD_STRUCTURES as readonly string[]).includes(raw);
}

/** Saved unit data may still say `trap` — that is Build. */
function normalizeAbilityId(raw: unknown): AbilityId | null {
  if (raw === 'trap') return 'build';
  return isAbilityId(raw) ? raw : null;
}

export function sanitizeAbilities(raw: unknown, fallback: readonly AbilityId[] = []): AbilityId[] {
  const src = Array.isArray(raw) ? raw : fallback;
  const out: AbilityId[] = [];
  for (const a of src) {
    const id = normalizeAbilityId(a);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export function abilitiesEqual(a: readonly AbilityId[], b: readonly AbilityId[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}
