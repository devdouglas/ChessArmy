/**
 * Toggleable gameplay rules that are still in playtest.
 * Stock = the defaults below. Saved in this browser.
 */
import { notifyPersist } from './persist-hook';

const STORAGE_KEY = 'chessarmy-experimental-v1';

export const EXPERIMENTAL_RULES = [
  {
    id: 'block-red-move',
    label: 'Block movement toward red faces',
    blurb:
      'A −2 (red) hex-armor face cannot be walked — those hexes are not legal dests. Usually the rear. Off: you can move that way.',
  },
  {
    id: 'block-red-shoot',
    label: 'Block shooting toward red faces',
    blurb:
      'A −2 (red) hex-armor face cannot be shot — those hexes are not legal fire targets. Usually the rear. Off: you can shoot that way.',
  },
  {
    id: 'walk-orders',
    label: 'Walk to destination orders',
    blurb:
      'Select a unit, then hover or click any tile it can reach. The route lights up white. It walks that route at its move speed — when you click, and again each later turn you give it no other order — until it arrives. Click the destination again to cancel.',
  },
] as const;

export type ExperimentalRuleId = (typeof EXPERIMENTAL_RULES)[number]['id'];

type Flags = Record<ExperimentalRuleId, boolean>;

const DEFAULTS: Flags = {
  'block-red-move': true,
  'block-red-shoot': true,
  'walk-orders': false,
};

const RULE_IDS: ExperimentalRuleId[] = EXPERIMENTAL_RULES.map((r) => r.id);

export function isExperimentalRuleId(id: unknown): id is ExperimentalRuleId {
  return typeof id === 'string' && RULE_IDS.includes(id as ExperimentalRuleId);
}

function sanitize(raw: unknown): Flags {
  const out: Flags = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  if (typeof src['block-red-faces'] === 'boolean') {
    out['block-red-move'] = src['block-red-faces'];
    out['block-red-shoot'] = src['block-red-faces'];
  }
  for (const id of RULE_IDS) {
    if (typeof src[id] === 'boolean') out[id] = src[id];
  }
  return out;
}

let flags: Flags = { ...DEFAULTS };

export function isExperimentalOn(id: ExperimentalRuleId): boolean {
  return flags[id] !== false;
}

export function setExperimental(id: ExperimentalRuleId, on: boolean): void {
  flags = { ...flags, [id]: on };
  persistExperimental();
}

export function experimentalAreStock(): boolean {
  return RULE_IDS.every((id) => flags[id] === DEFAULTS[id]);
}

export function persistExperimental(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch {
    /* ignore quota / private mode */
  }
  notifyPersist();
}

export function loadExperimental(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    flags = sanitize(JSON.parse(stored) as unknown);
  } catch {
    flags = { ...DEFAULTS };
  }
}

export function resetExperimental(): void {
  flags = { ...DEFAULTS };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notifyPersist();
}

loadExperimental();
