/**
 * AI checklist: every current pickAiAction behaviour, toggleable per style.
 * Aggressive is the default army style. Aggressive/defensive start fully
 * checked except Advance-only rules. Advance walks the army forward together.
 */
import {
  AI_STYLES,
  type AiStyle,
} from './engine';
import { notifyPersist } from './persist-hook';

const STORAGE_KEY = 'chessarmy-ai-checklist-v1';

/** Checklist groups, in pickAiAction order. */
export const AI_RULE_CATEGORIES = [
  'walking',
  'melee',
  'targeting',
  'chasing',
  'defending',
  'retreating',
] as const;

export type AiRuleCategory = (typeof AI_RULE_CATEGORIES)[number];

export const AI_RULE_CATEGORY_LABEL: Record<AiRuleCategory, string> = {
  walking: '1. Walking',
  melee: '2. Melee or shooting',
  targeting: '3. Targeting',
  chasing: '4. Chasing',
  defending: '5. Defending',
  retreating: '6. Retreating',
};

export const AI_RULES = [
  {
    id: 'avoid-notouch',
    category: 'walking',
    label: 'Never walk Do-not-touch',
    blurb: 'Paths that step on a Do-not-touch token are illegal for the AI.',
  },
  {
    id: 'never-capture-flags',
    category: 'walking',
    label: 'Never capture flags',
    blurb: 'Do not walk onto enemy or free flags, unless that move hits the enemy general.',
  },
  {
    id: 'avoid-pikes',
    category: 'walking',
    label: 'Avoid pikes',
    blurb: 'Do not walk onto pikes or hex-damage unless that move attacks the enemy general.',
  },
  {
    id: 'break-palisades',
    category: 'walking',
    label: 'Break palisades',
    blurb: 'Walking through palisades scores extra, more if the fence falls.',
  },
  {
    id: 'keep-line',
    category: 'walking',
    label: 'Keep the line',
    blurb: 'Rear units step first. Nobody outruns the slowest mover by more than one hex. Attacks still happen.',
  },
  {
    id: 'general-last',
    category: 'walking',
    label: 'Activate the general last',
    blurb: 'Other pieces act first unless only the king can.',
  },
  {
    id: 'shoot-first',
    category: 'melee',
    label: 'Shoot first',
    blurb: 'If a unit can shoot or melee, it shoots. Unchecked: melee instead. Attacking when possible is always on.',
  },
  {
    id: 'strongest-first',
    category: 'melee',
    label: 'Strongest first',
    blurb: 'Attack the highest-value enemy. Unchecked: the closest. General token +1 value.',
  },
  {
    id: 'value-scoring',
    category: 'melee',
    label: 'Value / weight scoring',
    blurb: 'Prefer high-value kills and damage.',
  },
  {
    id: 'general-restraint',
    category: 'melee',
    label: 'General does not dump into the army',
    blurb: 'Own general only attacks the enemy general, or a unit already in melee with him.',
  },
  {
    id: 'guard-owned-flags',
    category: 'targeting',
    label: 'Guard owned flags',
    blurb: 'Treat flags you already hold like the king. Enemy and free flags mean nothing.',
  },
  {
    id: 'advance-front',
    category: 'targeting',
    label: 'Advance the front',
    blurb: 'Walk toward the far edge of the board in this army’s file. Ignored while Attack has a live enemy. Unchecked: Attack / other hunts.',
  },
  {
    id: 'hunt-enemy-general',
    category: 'targeting',
    label: 'Attack',
    blurb: 'Close on the nearest enemy. Beats Advance when both are on. Unchecked: other hunts apply.',
  },
  {
    id: 'close-on-hunt',
    category: 'chasing',
    label: 'Close on the hunt',
    blurb: 'Moves that get closer to the hunt target score higher.',
  },
  {
    id: 'prefer-high-ground',
    category: 'chasing',
    label: 'Prefer high ground',
    blurb: 'Take the higher route to the hunt. When not attacking, walk onto higher ground within 3 hexes.',
  },
  {
    id: 'targets-defenses',
    category: 'defending',
    label: 'Targets defenses',
    blurb: 'Shoot or melee a wall or palisade that sits on the path to the hunt.',
  },
  {
    id: 'hold-position',
    category: 'defending',
    label: 'Hold position',
    blurb: 'When Attack is off: stay put and turn toward the nearest enemy. A ranged hit makes them move and try to attack the nearest unit.',
  },
  {
    id: 'no-flee',
    category: 'retreating',
    label: 'Do not flee',
    blurb: 'Heavily penalize walking away from the hunt.',
  },
  {
    id: 'return-to-start',
    category: 'retreating',
    label: 'Return to start position',
    blurb: 'When not hunting, walk back to the hex this unit spawned on.',
  },
  {
    id: 'avoid-skip',
    category: 'retreating',
    label: 'Avoid skipping',
    blurb: 'Skipping leftover actions is heavily penalized.',
  },
] as const;

export type AiRuleId = (typeof AI_RULES)[number]['id'];
export type AiRule = (typeof AI_RULES)[number];
export type AiChecklist = Record<AiStyle, Record<AiRuleId, boolean>>;

const RULE_IDS = AI_RULES.map((r) => r.id);

export function isAiRuleId(v: unknown): v is AiRuleId {
  return typeof v === 'string' && RULE_IDS.includes(v as AiRuleId);
}

function stockCol(overrides: Partial<Record<AiRuleId, boolean>> = {}): Record<AiRuleId, boolean> {
  const col = {} as Record<AiRuleId, boolean>;
  for (const id of RULE_IDS) col[id] = true;
  col['advance-front'] = false;
  col['keep-line'] = false;
  return { ...col, ...overrides };
}

export function defaultAiChecklist(): AiChecklist {
  return {
    aggressive: stockCol(),
    defensive: stockCol(),
    advance: stockCol({
      'hunt-enemy-general': false,
      'guard-owned-flags': false,
      'return-to-start': false,
      'hold-position': false,
      'advance-front': true,
      'keep-line': true,
    }),
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
  const stock = defaultAiChecklist();
  return AI_STYLES.every((style) =>
    RULE_IDS.every((id) => checklist[style][id] === stock[style][id]),
  );
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
