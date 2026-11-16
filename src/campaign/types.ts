export type Point = { x: number; y: number };

export const CAPITAL_KEYS = [
  'carthage',
  'madrid',
  'rome',
  'paris',
  'athens',
  'alexandria',
  'moscow',
] as const;

export type CapitalKey = (typeof CAPITAL_KEYS)[number];

export const CAPITAL_LABEL: Record<CapitalKey, string> = {
  carthage: 'Carthage',
  madrid: 'Madrid',
  rome: 'Rome',
  paris: 'Paris',
  athens: 'Athens',
  alexandria: 'Alexandria',
  moscow: 'Moscow',
};

export type SettlementNone = { kind: 'none' };
export type SettlementVillage = { kind: 'village'; at: Point };
export type SettlementCapital = {
  kind: 'capital';
  key: CapitalKey;
  at: Point;
  units: string[];
};
export type Settlement = SettlementNone | SettlementVillage | SettlementCapital;

export type CampaignFaction = {
  id: string;
  name: string;
  color: string;
};

export type CampaignRegion = {
  id: string;
  name: string;
  ring: Point[];
  ownerId: string | null;
  settlement: Settlement;
};

export type SeaNode = {
  id: string;
  kind: 'port' | 'stop';
  at: Point;
  regionId?: string;
};

export type SeaLink = {
  id: string;
  kind: 'blue' | 'red';
  a: string;
  b: string;
};

export type CampaignMap = {
  id: 'europe';
  name: string;
  view: { x: number; y: number; w: number; h: number };
  factions: CampaignFaction[];
  regions: CampaignRegion[];
  seaNodes: SeaNode[];
  seaLinks: SeaLink[];
  neighbors: Record<string, string[]>;
};

export const DEFAULT_VIEW = { x: 0, y: 0, w: 1400, h: 900 };

/** Stock factions for the Owned-by picker. */
export const DEFAULT_FACTIONS: CampaignFaction[] = [
  { id: 'barbarians', name: 'Barbarians', color: '#6b5b4b' },
  { id: 'gaule', name: 'Gaule', color: '#2e7d32' },
  { id: 'spain', name: 'Spain', color: '#c62828' },
  { id: 'caragheu', name: 'Caragheu', color: '#f9a825' },
  { id: 'rome', name: 'Rome', color: '#b71c1c' },
  { id: 'egypt', name: 'Egypt', color: '#f4d03f' },
];

export function emptyCampaignMap(name = 'Europe'): CampaignMap {
  return {
    id: 'europe',
    name,
    view: { ...DEFAULT_VIEW },
    factions: DEFAULT_FACTIONS.map((f) => ({ ...f })),
    regions: [],
    seaNodes: [],
    seaLinks: [],
    neighbors: {},
  };
}

export function isCapitalKey(v: unknown): v is CapitalKey {
  return typeof v === 'string' && (CAPITAL_KEYS as readonly string[]).includes(v);
}
