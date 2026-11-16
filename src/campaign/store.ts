import {
  CAPITAL_KEYS,
  DEFAULT_FACTIONS,
  DEFAULT_VIEW,
  emptyCampaignMap,
  isCapitalKey,
  type CampaignFaction,
  type CampaignMap,
  type CampaignRegion,
  type Point,
  type SeaLink,
  type SeaNode,
  type Settlement,
} from './types';
import { sanitizeUnitAccess } from './units';
import { computeNeighbors } from './geometry';

const STORAGE_KEY = 'chessarmy-campaign-europe-v1';
const API_URL = `${import.meta.env.BASE_URL}campaign-api.php`;
const SAVE_KEY = 'warchess-oneshot';

function isPoint(v: unknown): v is Point {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as Point).x === 'number' &&
    typeof (v as Point).y === 'number' &&
    Number.isFinite((v as Point).x) &&
    Number.isFinite((v as Point).y)
  );
}

function parseSettlement(raw: unknown): Settlement {
  if (!raw || typeof raw !== 'object') return { kind: 'none' };
  const s = raw as Record<string, unknown>;
  if (s.kind === 'village' && isPoint(s.at)) {
    return { kind: 'village', at: { x: s.at.x, y: s.at.y } };
  }
  if (s.kind === 'capital' && isCapitalKey(s.key) && isPoint(s.at)) {
    return {
      kind: 'capital',
      key: s.key,
      at: { x: s.at.x, y: s.at.y },
      units: sanitizeUnitAccess(s.units),
    };
  }
  return { kind: 'none' };
}

function parseRegion(raw: unknown, i: number): CampaignRegion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.ring) || r.ring.length < 3) return null;
  const ring = r.ring.filter(isPoint).map((p) => ({ x: p.x, y: p.y }));
  if (ring.length < 3) return null;
  const id = typeof r.id === 'string' && r.id ? r.id : `region-${i}`;
  const name = typeof r.name === 'string' ? r.name : `Region ${i + 1}`;
  const ownerId =
    typeof r.ownerId === 'string' && r.ownerId ? r.ownerId : null;
  return {
    id,
    name,
    ring,
    ownerId,
    settlement: parseSettlement(r.settlement),
  };
}

function parseFaction(raw: unknown, i: number): CampaignFaction | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  const id = typeof f.id === 'string' && f.id ? f.id : `faction-${i}`;
  const name = typeof f.name === 'string' ? f.name : `Faction ${i + 1}`;
  const color =
    typeof f.color === 'string' && f.color ? f.color : '#888888';
  return { id, name, color };
}

function parseSeaNode(raw: unknown, i: number): SeaNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const n = raw as Record<string, unknown>;
  if (!isPoint(n.at)) return null;
  const kind = n.kind === 'port' || n.kind === 'stop' ? n.kind : null;
  if (!kind) return null;
  const id = typeof n.id === 'string' && n.id ? n.id : `sea-${i}`;
  const node: SeaNode = { id, kind, at: { x: n.at.x, y: n.at.y } };
  if (kind === 'port' && typeof n.regionId === 'string') {
    node.regionId = n.regionId;
  }
  return node;
}

function parseSeaLink(raw: unknown, i: number): SeaLink | null {
  if (!raw || typeof raw !== 'object') return null;
  const l = raw as Record<string, unknown>;
  if (typeof l.a !== 'string' || typeof l.b !== 'string') return null;
  const kind = l.kind === 'blue' || l.kind === 'red' ? l.kind : null;
  if (!kind) return null;
  const id = typeof l.id === 'string' && l.id ? l.id : `link-${i}`;
  return { id, kind, a: l.a, b: l.b };
}

/** Normalize / validate unknown JSON into a CampaignMap. */
export function parseCampaignMap(raw: unknown): CampaignMap {
  const base = emptyCampaignMap();
  if (!raw || typeof raw !== 'object') return base;
  const m = raw as Record<string, unknown>;
  base.name = typeof m.name === 'string' && m.name ? m.name : base.name;
  if (m.view && typeof m.view === 'object') {
    const v = m.view as Record<string, unknown>;
    const x = typeof v.x === 'number' ? v.x : DEFAULT_VIEW.x;
    const y = typeof v.y === 'number' ? v.y : DEFAULT_VIEW.y;
    const w = typeof v.w === 'number' && v.w > 0 ? v.w : DEFAULT_VIEW.w;
    const h = typeof v.h === 'number' && v.h > 0 ? v.h : DEFAULT_VIEW.h;
    base.view = { x, y, w, h };
  }
  if (Array.isArray(m.factions)) {
    base.factions = m.factions
      .map(parseFaction)
      .filter((f): f is CampaignFaction => !!f);
  }
  if (base.factions.length === 0) {
    base.factions = DEFAULT_FACTIONS.map((f) => ({ ...f }));
  }
  if (Array.isArray(m.regions)) {
    base.regions = m.regions
      .map(parseRegion)
      .filter((r): r is CampaignRegion => !!r);
  }
  if (Array.isArray(m.seaNodes)) {
    base.seaNodes = m.seaNodes
      .map(parseSeaNode)
      .filter((n): n is SeaNode => !!n);
  }
  if (Array.isArray(m.seaLinks)) {
    base.seaLinks = m.seaLinks
      .map(parseSeaLink)
      .filter((l): l is SeaLink => !!l);
  }

  // Drop duplicate capital keys (keep first).
  const seen = new Set<string>();
  for (const region of base.regions) {
    if (region.settlement.kind !== 'capital') continue;
    if (seen.has(region.settlement.key)) {
      region.settlement = { kind: 'none' };
    } else {
      seen.add(region.settlement.key);
    }
  }
  // Drop capital keys not in the fixed list (already filtered by isCapitalKey).
  void CAPITAL_KEYS;

  // Open ground (no village/capital) cannot be owned
  neutralizeOpenGround(base.regions);

  base.neighbors = computeNeighbors(base.regions);
  return base;
}

/** Regions without a village or capital are always neutral. */
export function neutralizeOpenGround(regions: CampaignRegion[]): void {
  for (const r of regions) {
    if (r.settlement.kind === 'none') r.ownerId = null;
  }
}

export function prepareForSave(map: CampaignMap): CampaignMap {
  neutralizeOpenGround(map.regions);
  return {
    ...map,
    id: 'europe',
    neighbors: computeNeighbors(map.regions),
  };
}

export function readLocalCampaign(): CampaignMap | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseCampaignMap(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLocalCampaign(map: CampaignMap): void {
  const ready = prepareForSave(map);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ready));
}

export async function fetchCampaignMap(): Promise<CampaignMap | null> {
  try {
    const res = await fetch(API_URL, {
      headers: { 'X-Warchess-Key': SAVE_KEY, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.ok === false) return null;
    const payload = data.map ?? data;
    return parseCampaignMap(payload);
  } catch {
    return null;
  }
}

export async function pushCampaignMap(map: CampaignMap): Promise<boolean> {
  const ready = prepareForSave(map);
  writeLocalCampaign(ready);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Warchess-Key': SAVE_KEY,
        Accept: 'application/json',
      },
      body: JSON.stringify({ map: ready }),
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return !!(data && data.ok !== false);
  } catch {
    return false;
  }
}

/** Server → local → empty. */
export async function loadCampaignMap(): Promise<CampaignMap> {
  const remote = await fetchCampaignMap();
  if (remote && (remote.regions.length > 0 || remote.factions.length > 0 || remote.name !== 'Europe')) {
    writeLocalCampaign(remote);
    return remote;
  }
  const local = readLocalCampaign();
  if (local) return local;
  if (remote) return remote;
  return emptyCampaignMap();
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
