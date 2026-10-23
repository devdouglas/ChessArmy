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
    id: 'shoot-first',
    category: 'targeting',
    label: 'Shoot first',
    blurb: 'If a unit can shoot or melee, it shoots. Unchecked: melee instead. Attacking when possible is always on.',
  },
  {
    id: 'strongest-first',
    category: 'targeting',
    label: 'Strongest first',
    blurb: 'Attack the highest-value enemy. Unchecked: the closest. General token +1 value.',
  },
  {
    id: 'hunt-enemy-general',
    category: 'targeting',
    label: 'Attack',
    blurb: 'Close on the enemy general, else the nearest enemy. Unchecked: other pathfinding rules apply.',
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
    blurb: 'When not hunting, move onto higher ground within 3 hexes. Climbing still scores up while hunting.',
  },
  {
    id: 'return-to-start',
    category: 'pathfinding',
    label: 'Return to start position',
    blurb: 'When not hunting, walk back to the hex this unit spawned on.',
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
    id: 'hold-position',
    category: 'engagement',
    label: 'Hold position',
    blurb: 'Stay put and turn toward the nearest enemy. A ranged hit makes them move and try to attack the nearest unit.',
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
    if (
      typeof map['shoot-first'] !== 'boolean' &&
      typeof map['prefer-attacks'] === 'boolean'
    ) {
      out[style]['shoot-first'] = map['prefer-attacks'];
    }
    if (
      typeof map['strongest-first'] !== 'boolean' &&
      typeof map['prefer-general-kills'] === 'boolean'
    ) {
      out[style]['strongest-first'] = map['prefer-general-kills'];
    }
    if (typeof map['hold-position'] !== 'boolean') {
      if (typeof map['hoplite-hold'] === 'boolean') {
        out[style]['hold-position'] = map['hoplite-hold'];
      } else if (typeof map['hoplite-advance-on-hit'] === 'boolean') {
        out[style]['hold-position'] = map['hoplite-advance-on-hit'];
      }
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

export function categoryRules(category: AiRuleCategory): AiRule[] {
  return AI_RULES.filter((r) => r.category === category);
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
