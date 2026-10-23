/**
 * AI checklist: every current pickAiAction behaviour, toggleable per style.
 * Aggressive is the default army style. Both columns start fully checked.
 */
import {
  AI_STYLES,
  type AiStyle,
} from './engine';
import { notifyPersist } from './persist-hook';

const STORAGE_KEY = 'chessarmy-ai-checklist-v1';

export const AI_RULE_CATEGORIES = [
  'targeting',
  'pathfinding',
  'engagement',
  'general',
] as const;

export type AiRuleCategory = (typeof AI_RULE_CATEGORIES)[number];

export const AI_RULE_CATEGORY_LABEL: Record<AiRuleCategory, string> = {
  targeting: 'Targeting',
  pathfinding: 'Pathfinding',
  engagement: 'Rules of engagement',
  general: 'General decisions',
};

export const AI_RULES = [
  {
    id: 'prefer-attacks',
    category: 'targeting',
    label: 'Take any shot or melee',
    blurb: 'If anyone can shoot or melee, they do.',
  },
  {
    id: 'prefer-general-kills',
    category: 'targeting',
    label: 'Prioritize the enemy general',
    blurb: 'Attacks that hit the enemy general go first.',
  },
  {
    id: 'hunt-enemy-general',
    category: 'targeting',
    label: 'Hunt the enemy general',
    blurb: 'Close on the enemy general, else the nearest enemy.',
  },
  {
    id: 'guard-owned-flags',
    category: 'targeting',
    label: 'Guard owned flags',
    blurb: 'Treat flags you already hold like the king. Enemy and free flags mean nothing.',
  },
  {
    id: 'value-scoring',
    category: 'targeting',
    label: 'Value / weight scoring',
    blurb: 'Prefer high-value kills and damage.',
  },
  {
    id: 'close-on-hunt',
    category: 'pathfinding',
    label: 'Close on the hunt',
    blurb: 'Moves that get closer to the hunt target score higher.',
  },
  {
    id: 'no-flee',
    category: 'pathfinding',
    label: 'Do not flee',
    blurb: 'Heavily penalize walking away from the hunt.',
  },
  {
    id: 'avoid-pikes',
    category: 'pathfinding',
    label: 'Avoid pikes',
    blurb: 'Do not walk onto pikes or hex-damage unless that move attacks the enemy general.',
  },
  {
    id: 'avoid-notouch',
    category: 'pathfinding',
    label: 'Never walk Do-not-touch',
    blurb: 'Paths that step on a Do-not-touch token are illegal for the AI.',
  },
  {
    id: 'prefer-high-ground',
    category: 'pathfinding',
    label: 'Prefer high ground',
    blurb: 'Climbing scores up; dropping scores down.',
  },
  {
    id: 'targets-defenses',
    category: 'pathfinding',
    label: 'Targets defenses',
    blurb: 'Shoot or melee a wall or palisade that sits on the path to the hunt.',
  },
  {
    id: 'general-restraint',
    category: 'engagement',
    label: 'General does not dump into the army',
    blurb: 'Own general only attacks the enemy general, or a unit already in melee with him.',
  },
  {
    id: 'never-capture-flags',
    category: 'engagement',
    label: 'Never capture flags',
    blurb: 'Do not walk onto enemy or free flags, unless that move hits the enemy general.',
  },
  {
    id: 'hoplite-hold',
    category: 'engagement',
    label: 'Hoplites hold',
    blurb: 'Unprovoked hoplites stay put and turn toward the nearest enemy.',
  },
  {
    id: 'hoplite-advance-on-hit',
    category: 'engagement',
    label: 'Hoplites advance after a ranged hit',
    blurb: 'A ranged hit makes them step forward and try to attack, then hold again.',
  },
  {
    id: 'general-last',
    category: 'general',
    label: 'Activate the general last',
    blurb: 'Other pieces act first unless only the king can.',
  },
  {
    id: 'avoid-skip',
    category: 'general',
    label: 'Avoid skipping',
    blurb: 'Skipping leftover actions is heavily penalized.',
  },
  {
    id: 'break-palisades',
    category: 'general',
    label: 'Break palisades',
    blurb: 'Walking through palisades scores extra, more if the fence falls.',
  },
] as const;

export type AiRuleId = (typeof AI_RULES)[number]['id'];
export type AiRule = (typeof AI_RULES)[number];
export type AiChecklist = Record<AiStyle, Record<AiRuleId, boolean>>;

const RULE_IDS = AI_RULES.map((r) => r.id);

export function isAiRuleId(v: unknown): v is AiRuleId {
  return typeof v === 'string' && RULE_IDS.includes(v as AiRuleId);
}

export function defaultAiChecklist(): AiChecklist {
  const col = {} as Record<AiRuleId, boolean>;
  for (const id of RULE_IDS) col[id] = true;
  return {
    aggressive: { ...col },
    defensive: { ...col },
  };
}

export function sanitizeAiChecklist(raw: unknown): AiChecklist {
  const out = defaultAiChecklist();
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  for (const style of AI_STYLES) {
    const col = src[style];
    if (!col || typeof col !== 'object') continue;
    const map = col as Record<string, unknown>;
    for (const id of RULE_IDS) {
      if (typeof map[id] === 'boolean') out[style][id] = map[id];
    }
    if (
      typeof map['targets-defenses'] !== 'boolean' &&
      typeof map['no-waste-shots'] === 'boolean'
    ) {
      out[style]['targets-defenses'] = map['no-waste-shots'];
    }
  }
  return out;
}

let checklist: AiChecklist = defaultAiChecklist();

export function getAiChecklist(): AiChecklist {
  return checklist;
}

export function aiChecklistAreStock(): boolean {
  return AI_STYLES.every((style) => RULE_IDS.every((id) => checklist[style][id]));
}

export function isAiRuleOn(style: AiStyle, id: AiRuleId): boolean {
  return checklist[style][id] !== false;
}

export function setAiRule(style: AiStyle, id: AiRuleId, on: boolean): void {
  checklist = {
    ...checklist,
    [style]: { ...checklist[style], [id]: on },
  };
  persistAiChecklist();
}

export function setAiCategory(
  style: AiStyle,
  category: AiRuleCategory,
  on: boolean,
): void {
  const col = { ...checklist[style] };
  for (const rule of AI_RULES) {
    if (rule.category === category) col[rule.id] = on;
  }
  checklist = { ...checklist, [style]: col };
  persistAiChecklist();
}

export function setAiStyleColumn(style: AiStyle, on: boolean): void {
  const col = { ...checklist[style] };
  for (const id of RULE_IDS) col[id] = on;
  checklist = { ...checklist, [style]: col };
  persistAiChecklist();
}

export function categoryRules(category: AiRuleCategory): AiRule[] {
  return AI_RULES.filter((r) => r.category === category);
}

export function categoryAllOn(style: AiStyle, category: AiRuleCategory): boolean {
  return categoryRules(category).every((r) => checklist[style][r.id]);
}

export function categoryAnyOn(style: AiStyle, category: AiRuleCategory): boolean {
  return categoryRules(category).some((r) => checklist[style][r.id]);
}

export function styleAllOn(style: AiStyle): boolean {
  return RULE_IDS.every((id) => checklist[style][id]);
}

export function styleAnyOn(style: AiStyle): boolean {
  return RULE_IDS.some((id) => checklist[style][id]);
}

export function persistAiChecklist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checklist));
  } catch {
    /* ignore quota / private mode */
  }
  notifyPersist();
}

export function applyRemoteAiChecklist(raw: unknown): void {
  checklist = sanitizeAiChecklist(raw);
}

export function loadAiChecklist(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored) as unknown;
    checklist = sanitizeAiChecklist(parsed);
  } catch {
    checklist = defaultAiChecklist();
  }
}

export function resetAiChecklist(): void {
  checklist = defaultAiChecklist();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notifyPersist();
}

loadAiChecklist();
