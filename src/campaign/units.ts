import { UNIT_STATS, UNIT_TYPES } from '../roster';

export type CampaignUnitAccess = {
  id: string;
  label: string;
};

/** All units in the ancient period roster (stock + customs). */
export function listCampaignUnitAccess(): CampaignUnitAccess[] {
  const out: CampaignUnitAccess[] = [];
  for (const id of UNIT_TYPES) {
    const stats = UNIT_STATS[id];
    if (!stats || stats.category !== 'ancient') continue;
    out.push({ id, label: stats.name });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

export function campaignUnitAccessIds(): string[] {
  return listCampaignUnitAccess().map((u) => u.id);
}

/** Legacy campaign-editor placeholders → closest ancient roster ids. */
const LEGACY_UNIT_MAP: Record<string, string> = {
  infantry: 'cohort',
  cavalry: 'horsearcher',
  pike: 'hoplite',
  skirmisher: 'javelin',
  general: 'barbarian',
};

export function sanitizeUnitAccess(ids: unknown): string[] {
  const allowed = new Set(campaignUnitAccessIds());
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const id = allowed.has(raw) ? raw : LEGACY_UNIT_MAP[raw];
    if (!id || !allowed.has(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
