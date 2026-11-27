/**
 * Terrain generator: a preset is a recipe (per-layer amount / link chance / placement)
 * that paints the editor board. Works on any grid: rect or hex disk, pointy or flat.
 *
 * Layers paint in height order (water → hills → plateau → mountain), then wood
 * tokens (forest → trees → palisade). Seeded, so a good roll can be replayed.
 */
import { terrainHeight, type Terrain, type TileToken, type TokenType } from './engine';
import {
  hexToPixel,
  neighborInDir,
  neighbors,
  distance,
  type Hex,
  type HexDir,
  type HexOrientation,
} from './hex';

export const TERRAIN_LAYER_IDS = [
  'water',
  'hills',
  'plateau',
  'mountain',
  'forest',
  'trees',
  'grass',
  'palisade',
  'houses',
] as const;
export type TerrainLayerId = (typeof TERRAIN_LAYER_IDS)[number];

export const TERRAIN_LAYER_LABEL: Record<TerrainLayerId, string> = {
  water: 'Water',
  hills: 'Hills',
  plateau: 'Plateau',
  mountain: 'Mountain',
  forest: 'Forest',
  trees: 'Trees',
  grass: 'Long grass',
  palisade: 'Palisade',
  houses: 'Houses',
};

/**
 * Hard limits. Edge placements use only the outer EDGE_LINES lines of that side(s);
 * center uses everything except those lines on all four sides.
 */
export const LAYER_BIASES = ['any', 'center', 'edges-tb', 'edges-lr', 'edges-all'] as const;
export type LayerBias = (typeof LAYER_BIASES)[number];
export const LAYER_BIAS_LABEL: Record<LayerBias, string> = {
  any: 'Anywhere',
  center: 'Center (no edges)',
  'edges-tb': 'Edges top/bottom',
  'edges-lr': 'Edges left/right',
  'edges-all': 'Edges all',
};
export const EDGE_LINES = 3;
/** Odds each extra single-ramp descent is added on top of the forced one. */
export const SINGLE_RAMP_EXTRA = 0.12;

/** Make the map fair: copy one half onto the other. */
export const MIRROR_MODES = ['off', 'mirror', 'reversed'] as const;
export type MirrorMode = (typeof MIRROR_MODES)[number];
export const MIRROR_MODE_LABEL: Record<MirrorMode, string> = {
  off: 'Off',
  mirror: 'Exact mirror',
  reversed: 'Reversed mirror (180°)',
};
export const MIRROR_AXES = ['tb', 'lr'] as const;
export type MirrorAxis = (typeof MIRROR_AXES)[number];
export const MIRROR_AXIS_LABEL: Record<MirrorAxis, string> = {
  tb: 'Top ↔ bottom',
  lr: 'Left ↔ right',
};

/** How hard the terrain is to fight on (roguelite picks by it). */
export const TERRAIN_DIFFICULTY_LABEL = ['0 · trivial', '1 · easy', '2 · medium', '3 · hard'] as const;
export const MAX_TERRAIN_DIFFICULTY = TERRAIN_DIFFICULTY_LABEL.length - 1;
const BUILTIN_DIFFICULTY: Record<string, number> = {
  'builtin-open-field': 0,
  'builtin-village': 1,
  'builtin-long-grass': 1,
  'builtin-dense-forest': 2,
  'builtin-marshland': 2,
  'builtin-highlands': 2,
  'builtin-fortified-ridge': 3,
  'builtin-badlands': 3,
};

export const MAX_LAYER_AMOUNT = 80;
export const MAX_CLEAR_RADIUS = 4;
export const DEFAULT_LINK = 40;

export type TerrainLayer = {
  /** % of eligible hexes this layer covers. */
  amount: number;
  /**
   * % chance each new tile attaches next to a tile of the same type
   * (when one exists). 0 = scattered, 100 = one big blob.
   */
  link: number;
  bias: LayerBias;
};

export type TerrainConfig = {
  layers: Record<TerrainLayerId, TerrainLayer>;
  /** true: wipe tiles + wood first. false: paint onto what is already there. */
  replace: boolean;
  /** Add stepping tiles so every slope is ±1 (walkable). */
  ramps: boolean;
  /**
   * Instead of walkable slopes everywhere: every raised area (plateau / mountain) that
   * has no walkable way down gets exactly one ramp. The other cliffs stay cliffs.
   * Wins over `ramps` when both are set.
   */
  singleRamps: boolean;
  /**
   * Generate, then copy one half onto the other. `mirror` reflects across the middle
   * line (see `mirrorAxis`); `reversed` turns the first half 180° (point symmetry).
   */
  mirror: MirrorMode;
  mirrorAxis: MirrorAxis;
  /**
   * % of the hexes one line outside a layer's edge / center zone that are still open to
   * it. 0 = hard limit. Applies to every layer's placement.
   */
  bleed: number;
  /** 0 (trivial) … 3 (hard). */
  difficulty: number;
  /** Hexes kept clear around every unit. */
  clearRadius: number;
};

export type TerrainPreset = TerrainConfig & {
  id: string;
  name: string;
  builtin?: boolean;
  updatedAt: number;
};

type LayerSpec = [amount: number, link?: number, bias?: LayerBias];

function config(
  layers: Partial<Record<TerrainLayerId, LayerSpec>>,
  opts: Partial<
  Pick<TerrainConfig, 'replace' | 'ramps' | 'singleRamps' | 'mirror' | 'mirrorAxis' | 'bleed' | 'difficulty' | 'clearRadius'>
> = {},
): TerrainConfig {
  const out = {} as Record<TerrainLayerId, TerrainLayer>;
  for (const id of TERRAIN_LAYER_IDS) {
    const [amount = 0, link = DEFAULT_LINK, bias = 'any'] = layers[id] ?? [0];
    out[id] = { amount, link, bias };
  }
  return {
    layers: out,
    replace: opts.replace ?? true,
    ramps: opts.ramps ?? true,
    singleRamps: opts.singleRamps ?? false,
    mirror: opts.mirror ?? 'off',
    mirrorAxis: opts.mirrorAxis ?? 'tb',
    bleed: opts.bleed ?? 0,
    difficulty: opts.difficulty ?? 1,
    clearRadius: opts.clearRadius ?? 1,
  };
}

export const BUILTIN_TERRAIN_PRESETS: TerrainPreset[] = [
  {
    id: 'builtin-open-field',
    name: 'Open field',
    ...config({ hills: [4, 30], forest: [3, 40], trees: [2, 20], houses: [2, 60], grass: [8, 50] }),
  },
  {
    id: 'builtin-village',
    name: 'Village',
    ...config({
      houses: [14, 80, 'center'],
      grass: [6, 50],
      forest: [8, 50, 'edges-all'],
      trees: [4, 30],
      hills: [4, 40, 'edges-all'],
      water: [3, 60, 'edges-all'],
    }),
  },
  {
    id: 'builtin-dense-forest',
    name: 'Dense forest',
    ...config({
      forest: [38, 70],
      grass: [4, 40],
      trees: [6, 30],
      hills: [8, 50],
      water: [3, 60],
    }),
  },
  {
    id: 'builtin-long-grass',
    name: 'Long grass',
    ...config({
      grass: [42, 70],
      trees: [3, 20],
      hills: [6, 40],
      water: [4, 60, 'edges-all'],
    }),
  },
  {
    id: 'builtin-highlands',
    name: 'Highlands',
    ...config({
      hills: [18, 60],
      plateau: [12, 70],
      mountain: [5, 60, 'center'],
      forest: [5, 40],
      water: [3, 40, 'edges-all'],
    }),
  },
  {
    id: 'builtin-marshland',
    name: 'Marshland',
    ...config({
      water: [28, 80],
      grass: [12, 70],
      hills: [4, 30],
      forest: [10, 50],
      trees: [4, 30],
    }),
  },
  {
    id: 'builtin-fortified-ridge',
    name: 'Fortified ridge',
    ...config({
      hills: [14, 70, 'center'],
      plateau: [8, 80, 'center'],
      palisade: [8, 90, 'center'],
      forest: [4, 40],
    }),
  },
  {
    id: 'builtin-badlands',
    name: 'Badlands',
    ...config(
      {
        mountain: [12, 50],
        plateau: [14, 50],
        hills: [6, 20],
        trees: [2, 20],
      },
      { ramps: false },
    ),
  },
].map((p) => ({
  ...p,
  difficulty: BUILTIN_DIFFICULTY[p.id] ?? p.difficulty,
  builtin: true,
  updatedAt: 0,
})) as TerrainPreset[];

export const DEFAULT_TERRAIN_PRESET_ID = BUILTIN_TERRAIN_PRESETS[0]!.id;

export function cloneTerrainConfig(c: TerrainConfig): TerrainConfig {
  const layers = {} as Record<TerrainLayerId, TerrainLayer>;
  for (const id of TERRAIN_LAYER_IDS) layers[id] = { ...c.layers[id] };
  return {
    layers,
    replace: c.replace,
    ramps: c.ramps,
    singleRamps: c.singleRamps,
    mirror: c.mirror,
    mirrorAxis: c.mirrorAxis,
    bleed: c.bleed,
    difficulty: c.difficulty,
    clearRadius: c.clearRadius,
  };
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function sanitizeTerrainConfig(raw: unknown): TerrainConfig {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<TerrainConfig>;
  const layers = {} as Record<TerrainLayerId, TerrainLayer>;
  for (const id of TERRAIN_LAYER_IDS) {
    const l = (src.layers?.[id] ?? {}) as Partial<TerrainLayer> & { cluster?: number };
    // Presets saved before Link % stored `cluster` on a 0–10 scale.
    const legacy = l.cluster !== undefined ? Number(l.cluster) * 10 : undefined;
    layers[id] = {
      amount: clampInt(l.amount, 0, MAX_LAYER_AMOUNT, 0),
      link: clampInt(l.link ?? legacy, 0, 100, DEFAULT_LINK),
      bias: (LAYER_BIASES as readonly string[]).includes(l.bias as string)
        ? (l.bias as LayerBias)
        : (l.bias as string) === 'edge' // saved before edges were split by side
          ? 'edges-all'
          : 'any',
    };
  }
  return {
    layers,
    replace: src.replace !== false,
    ramps: src.ramps !== false,
    singleRamps: src.singleRamps === true,
    mirror: (MIRROR_MODES as readonly string[]).includes(src.mirror as string)
      ? (src.mirror as MirrorMode)
      : 'off',
    mirrorAxis: src.mirrorAxis === 'lr' ? 'lr' : 'tb',
    bleed: clampInt(src.bleed, 0, 100, 0),
    difficulty: clampInt(src.difficulty, 0, MAX_TERRAIN_DIFFICULTY, 1),
    clearRadius: clampInt(src.clearRadius, 0, MAX_CLEAR_RADIUS, 1),
  };
}

// ---------------------------------------------------------------- storage

const STORAGE_KEY = 'chessarmy-terrain-presets-v1';

function readUser(): TerrainPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p): p is TerrainPreset => !!p && typeof p.id === 'string' && !!p.name)
      .map((p) => ({
        ...sanitizeTerrainConfig(p),
        id: p.id,
        name: String(p.name).slice(0, 48),
        updatedAt: Number(p.updatedAt) || 0,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeUser(list: TerrainPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function listUserTerrainPresets(): TerrainPreset[] {
  return readUser();
}

export function getTerrainPreset(id: string | null): TerrainPreset | null {
  if (!id) return null;
  return (
    listBuiltinTerrainPresets().find((p) => p.id === id) ??
    readUser().find((p) => p.id === id) ??
    null
  );
}

// Built-ins can be edited and saved: the edit is stored as an override on top of
// the factory preset, and can be reset.
const BUILTIN_KEY = 'chessarmy-terrain-builtin-v1';

function readBuiltinOverrides(): Record<string, TerrainConfig> {
  try {
    const raw = JSON.parse(localStorage.getItem(BUILTIN_KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, TerrainConfig> = {};
    for (const [id, cfg] of Object.entries(raw)) {
      if (BUILTIN_TERRAIN_PRESETS.some((p) => p.id === id)) out[id] = sanitizeTerrainConfig(cfg);
    }
    return out;
  } catch {
    return {};
  }
}

/** Built-in presets with any saved edits applied. `modified` marks edited ones. */
export function listBuiltinTerrainPresets(): Array<TerrainPreset & { modified: boolean }> {
  const over = readBuiltinOverrides();
  return BUILTIN_TERRAIN_PRESETS.map((p) =>
    over[p.id] ? { ...p, ...over[p.id], modified: true } : { ...p, modified: false },
  );
}

export function saveBuiltinTerrainPreset(id: string, cfg: TerrainConfig): TerrainPreset | null {
  if (!BUILTIN_TERRAIN_PRESETS.some((p) => p.id === id)) return null;
  const over = readBuiltinOverrides();
  over[id] = sanitizeTerrainConfig(cfg);
  localStorage.setItem(BUILTIN_KEY, JSON.stringify(over));
  return getTerrainPreset(id);
}

/** Drop the saved edits; the factory preset comes back. */
export function resetBuiltinTerrainPreset(id: string): TerrainPreset | null {
  const over = readBuiltinOverrides();
  delete over[id];
  localStorage.setItem(BUILTIN_KEY, JSON.stringify(over));
  return getTerrainPreset(id);
}

export function saveTerrainPreset(
  name: string,
  cfg: TerrainConfig,
  existingId?: string | null,
): TerrainPreset {
  const list = readUser();
  const trimmed = name.trim().slice(0, 48) || 'Untitled terrain';
  const clean = sanitizeTerrainConfig(cfg);
  const now = Date.now();
  const idx = existingId ? list.findIndex((p) => p.id === existingId) : -1;
  if (idx >= 0) {
    const updated: TerrainPreset = { ...list[idx]!, ...clean, name: trimmed, updatedAt: now };
    list[idx] = updated;
    writeUser(list);
    return updated;
  }
  const created: TerrainPreset = {
    ...clean,
    id: `ter-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    updatedAt: now,
  };
  list.unshift(created);
  writeUser(list);
  return created;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Preset (built-in or saved) with this name, case-insensitive. */
export function findTerrainPresetByName(name: string): TerrainPreset | null {
  return (
    [...listBuiltinTerrainPresets(), ...readUser()].find((p) => sameName(p.name, name)) ?? null
  );
}

/** `name`, or `name 2`, `name 3`… so it clashes with no built-in or saved preset. */
export function uniqueTerrainName(name: string): string {
  const base = name.trim().slice(0, 44) || 'Untitled terrain';
  if (!findTerrainPresetByName(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const next = `${base} ${i}`;
    if (!findTerrainPresetByName(next)) return next;
  }
  return `${base} ${Date.now()}`;
}

export function deleteTerrainPreset(id: string): void {
  writeUser(readUser().filter((p) => p.id !== id));
}

// ---------------------------------------------------------------- generator

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tokens wiped by `replace` — everything this generator can place, plus bridges (water goes away). */
const REPLACED_TOKENS: ReadonlySet<TokenType> = new Set(['forest', 'tree', 'palisade', 'house', 'grass', 'bridge']);
/** Hexes with these are never painted over or raised. */
const STRUCTURE_TOKENS: ReadonlySet<TokenType> = new Set([
  'wall',
  'house',
  'flag',
  'board',
  'tutorial',
  'pikes',
]);
/** Tokens that may not share a hex with a generated forest / tree / palisade / house. */
const WOOD_TOKENS: ReadonlySet<TokenType> = new Set(['forest', 'tree', 'palisade', 'house', 'grass']);
const HEIGHT_TERRAIN: Terrain[] = ['land', 'high', 'plateau', 'rock'];

export type TerrainGenInput = {
  terrain: Terrain[][];
  tokens: TileToken[];
  /** Unit hexes (kept clear, plus `clearRadius` around them). */
  occupied: Hex[];
  orientation: HexOrientation;
  /** Hex-disk mask. Rect boards pass () => true. */
  onBoard: (col: number, row: number) => boolean;
  seed: number;
};

export type TerrainGenResult = {
  terrain: Terrain[][];
  tokens: TileToken[];
  placed: Record<TerrainLayerId, number>;
};

export function generateTerrain(cfg: TerrainConfig, input: TerrainGenInput): TerrainGenResult {
  const rows = input.terrain.length;
  const cols = input.terrain[0]?.length ?? 0;
  const o = input.orientation;
  const rng = mulberry32(input.seed);
  const key = (c: number, r: number) => `${c},${r}`;
  const inB = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < cols && r < rows && input.onBoard(c, r);
  const nbs = (c: number, r: number) =>
    neighbors({ col: c, row: r }, o).filter((n) => inB(n.col, n.row));

  const t = input.terrain.map((row) => [...row]);
  let tokens = input.tokens.map((tk) => ({ ...tk }));

  if (cfg.replace) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (inB(c, r) && t[r]![c] !== 'wall') t[r]![c] = 'land';
      }
    }
    tokens = tokens.filter((tk) => !(inB(tk.col, tk.row) && REPLACED_TOKENS.has(tk.type)));
  }

  // Locked: units (+ radius) and structures. Never painted, never raised.
  const locked = new Set<string>();
  for (const p of input.occupied) {
    locked.add(key(p.col, p.row));
  }
  if (cfg.clearRadius > 0 && input.occupied.length) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!inB(c, r)) continue;
        for (const p of input.occupied) {
          if (distance({ col: c, row: r }, p, o) <= cfg.clearRadius) {
            locked.add(key(c, r));
            break;
          }
        }
      }
    }
  }
  for (const tk of tokens) {
    if (STRUCTURE_TOKENS.has(tk.type)) locked.add(key(tk.col, tk.row));
  }
  const tokenCells = new Set(tokens.map((tk) => key(tk.col, tk.row)));
  const woodCells = new Set(
    tokens.filter((tk) => WOOD_TOKENS.has(tk.type)).map((tk) => key(tk.col, tk.row)),
  );

  const cells: Hex[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (inB(c, r)) cells.push({ col: c, row: r });
  const pos = cells.map((h) => hexToPixel(h, 1, o));

  // Edge lines, in screen space: one line = one hex pitch from the outermost cell.
  const pitchY = o === 'flat' ? Math.sqrt(3) : 1.5;
  const pitchX = o === 'flat' ? 1.5 : Math.sqrt(3);
  const minX = Math.min(...pos.map((p) => p.x));
  const maxX = Math.max(...pos.map((p) => p.x));
  const minY = Math.min(...pos.map((p) => p.y));
  const maxY = Math.max(...pos.map((p) => p.y));
  const eps = 1e-6;
  const edgeIdx = new Map<string, { tb: number; lr: number }>();
  cells.forEach((h, i) => {
    const { x, y } = pos[i]!;
    edgeIdx.set(key(h.col, h.row), {
      tb: Math.floor(Math.min(y - minY, maxY - y) / pitchY + eps),
      lr: Math.floor(Math.min(x - minX, maxX - x) / pitchX + eps),
    });
  });
  /** Hard placement limit: false = this layer may never use that hex. */
  const allowed = (bias: LayerBias, c: number, r: number): boolean => {
    if (bias === 'any') return true;
    const e = edgeIdx.get(key(c, r));
    if (!e) return false;
    // Lines past the allowed zone (0 = inside it).
    const over =
      bias === 'center'
        ? Math.max(EDGE_LINES - e.tb, EDGE_LINES - e.lr, 0)
        : bias === 'edges-tb'
          ? Math.max(e.tb - (EDGE_LINES - 1), 0)
          : bias === 'edges-lr'
            ? Math.max(e.lr - (EDGE_LINES - 1), 0)
            : Math.max(Math.min(e.tb, e.lr) - (EDGE_LINES - 1), 0);
    if (over === 0) return true;
    // Edge bleed: the line just outside the zone is open with `bleed`% chance per hex.
    return over === 1 && cfg.bleed > 0 && rng() * 100 < cfg.bleed;
  };

  const placed = Object.fromEntries(TERRAIN_LAYER_IDS.map((id) => [id, 0])) as Record<
    TerrainLayerId,
    number
  >;

  /** Weighted pick from `source`; removes the pick from `pool`. */
  const take = (pool: Hex[], source: Hex[], weight: (h: Hex) => number): Hex => {
    const ws = source.map((h) => Math.max(0, weight(h)));
    let total = 0;
    for (const w of ws) total += w;
    let i = source.length - 1;
    if (total > 0) {
      let x = rng() * total;
      for (let k = 0; k < source.length; k++) {
        x -= ws[k]!;
        if (x < 0) {
          i = k;
          break;
        }
      }
    } else {
      i = Math.floor(rng() * source.length);
    }
    const h = source[i]!;
    pool.splice(pool.indexOf(h), 1);
    return h;
  };

  /**
   * One placement. With probability `layer.link`% the tile must touch a same-type
   * tile (more same neighbours = likelier); otherwise it goes anywhere.
   */
  const pickLinked = (
    pool: Hex[],
    layer: TerrainLayer,
    isSame: (c: number, r: number) => boolean,
    extra: (h: Hex) => number = () => 1,
  ): Hex => {
    const sameN = (h: Hex) => nbs(h.col, h.row).filter((n) => isSame(n.col, n.row)).length;
    const touching = rng() * 100 < layer.link ? pool.filter((h) => sameN(h) > 0) : [];
    if (touching.length) {
      return take(
        pool,
        touching,
        (h) => sameN(h) * extra(h),
      );
    }
    return take(pool, pool, (h) => extra(h));
  };

  const paintTerrain = (
    id: TerrainLayerId,
    type: Terrain,
    affinity: (c: number, r: number) => number = () => 1,
  ) => {
    const layer = cfg.layers[id];
    if (layer.amount <= 0) return;
    const pool = cells.filter(
      (h) =>
        !locked.has(key(h.col, h.row)) &&
        !tokenCells.has(key(h.col, h.row)) &&
        allowed(layer.bias, h.col, h.row) &&
        t[h.row]![h.col] === 'land',
    );
    const n = Math.min(pool.length, Math.round((pool.length * layer.amount) / 100));
    for (let i = 0; i < n; i++) {
      const h = pickLinked(pool, layer, (x, y) => t[y]![x] === type, (c) =>
        affinity(c.col, c.row),
      );
      t[h.row]![h.col] = type;
      placed[id] += 1;
    }
  };

  const nearHeight = (c: number, r: number, min: number) =>
    nbs(c, r).some((n) => terrainHeight(t[n.row]![n.col]!) >= min);

  /**
   * Single ramps: every raised area (connected hexes of height ≥ 2) gets at least one way
   * down. The forced one is the cheapest straight descent from the rim. After that the
   * random pass may add more descents, each candidate with `SINGLE_RAMP_EXTRA` odds, so
   * some areas get several ramps and others stay with one.
   */
  const singleRampPass = () => {
    const hgt = (c: number, r: number) => terrainHeight(t[r]![c]!);
    type Ramp = { steps: Hex[]; heights: number[] };
    const plan = (a: Hex, dir: HexDir): Ramp | null => {
      const steps: Hex[] = [];
      const heights: number[] = [];
      let cur = a;
      let h = hgt(a.col, a.row);
      while (h > 1) {
        const c = neighborInDir(cur, dir, o);
        if (!inB(c.col, c.row) || locked.has(key(c.col, c.row))) return null;
        const tt = t[c.row]![c.col]!;
        if (tt === 'water' || tt === 'wall') return null;
        const hc = hgt(c.col, c.row);
        if (hc >= h) return null;
        const next = Math.max(hc, h - 1);
        if (next !== hc) {
          steps.push(c);
          heights.push(next);
        }
        cur = c;
        h = next;
      }
      return steps.length ? { steps, heights } : null;
    };
    const apply = (r: Ramp) =>
      r.steps.forEach((c, i) => {
        t[c.row]![c.col] = HEIGHT_TERRAIN[r.heights[i]!]!;
      });
    const seen = new Set<string>();
    for (const start of cells) {
      if (hgt(start.col, start.row) < 2 || seen.has(key(start.col, start.row))) continue;
      const area: Hex[] = [];
      const queue = [start];
      seen.add(key(start.col, start.row));
      while (queue.length) {
        const h = queue.pop()!;
        area.push(h);
        for (const n of nbs(h.col, h.row)) {
          const k = key(n.col, n.row);
          if (seen.has(k) || hgt(n.col, n.row) < 2) continue;
          seen.add(k);
          queue.push(n);
        }
      }
      // Every (rim-or-raised hex, direction) that leads down to height 1.
      const candidates: Array<{ a: Hex; d: HexDir }> = [];
      for (const a of area) {
        for (let d = 0; d < 6; d++) {
          const nb = neighborInDir(a, d as HexDir, o);
          if (!inB(nb.col, nb.row) || hgt(nb.col, nb.row) >= 2) continue;
          candidates.push({ a, d: d as HexDir });
        }
      }
      // Forced: only when no walkable way down already exists in this area.
      const walkable = area.some(
        (h) => hgt(h.col, h.row) === 2 && nbs(h.col, h.row).some((n) => hgt(n.col, n.row) === 1),
      );
      if (!walkable) {
        let best: Ramp[] = [];
        for (const c of candidates) {
          const r = plan(c.a, c.d);
          if (!r) continue;
          if (!best.length || r.steps.length < best[0]!.steps.length) best = [r];
          else if (r.steps.length === best[0]!.steps.length) best.push(r);
        }
        const pick = best[Math.floor(rng() * best.length)];
        if (pick) apply(pick);
      }
      // Random extras on top of the forced one.
      for (const c of candidates) {
        if (rng() >= SINGLE_RAMP_EXTRA) continue;
        const r = plan(c.a, c.d);
        if (r) apply(r);
      }
    }
  };

  paintTerrain('water', 'water');
  paintTerrain('hills', 'high');
  paintTerrain('plateau', 'plateau', (c, r) => (nearHeight(c, r, 1) ? 3 : 1));
  paintTerrain('mountain', 'rock', (c, r) => (nearHeight(c, r, 2) ? 3 : 1));

  if (cfg.singleRamps) {
    singleRampPass();
  } else if (cfg.ramps) {
    // Locked hexes can't be raised, so cap every other hex at (locked height + distance):
    // that keeps slopes next to units / flags walkable too.
    const cap = new Map<string, number>();
    for (const h of cells) {
      const k = key(h.col, h.row);
      if (locked.has(k)) cap.set(k, terrainHeight(t[h.row]![h.col]!));
    }
    if (cap.size) {
      for (let guard = 0; guard < cells.length; guard++) {
        let changed = false;
        for (const h of cells) {
          const k = key(h.col, h.row);
          let best = cap.get(k) ?? Infinity;
          for (const n of nbs(h.col, h.row)) {
            const v = (cap.get(key(n.col, n.row)) ?? Infinity) + 1;
            if (v < best) best = v;
          }
          if (best !== (cap.get(k) ?? Infinity)) {
            cap.set(k, best);
            changed = true;
          }
        }
        if (!changed) break;
      }
      for (const h of cells) {
        const k = key(h.col, h.row);
        if (locked.has(k)) continue;
        const max = cap.get(k) ?? Infinity;
        const here = terrainHeight(t[h.row]![h.col]!);
        if (here > max) t[h.row]![h.col] = HEIGHT_TERRAIN[max]!;
      }
    }
    for (let guard = 0; guard < 12; guard++) {
      let changed = false;
      for (const h of cells) {
        const here = terrainHeight(t[h.row]![h.col]!);
        if (here < 2) continue;
        for (const n of nbs(h.col, h.row)) {
          if (locked.has(key(n.col, n.row))) continue;
          const nt = t[n.row]![n.col]!;
          if (nt === 'water' || nt === 'wall') continue;
          if (terrainHeight(nt) <= here - 2) {
            t[n.row]![n.col] = HEIGHT_TERRAIN[here - 1]!;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
  }

  /**
   * Copy the first half onto the second, in screen space. A hex is paired only with the
   * board hex at its exact reflected pixel spot (no nearest-hex guessing), so a pair is
   * always a true mirror image. Offset grids cannot reflect exactly across every line,
   * so the fold line is chosen among the candidate axes that pair the most hexes, and
   * unpaired hexes are left as generated. Paired hexes with a unit, its clear radius,
   * or a structure are skipped.
   */
  const mirrorPass = () => {
    if (!cells.length) return;
    const axis = cfg.mirror === 'reversed' ? 'rot' : cfg.mirrorAxis;
    const xs = pos.map((p) => p.x);
    const ys = pos.map((p) => p.y);
    const mid = (vals: number[]) => (Math.min(...vals) + Math.max(...vals)) / 2;
    const qk = (x: number, y: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
    const at = new Map<string, number>();
    pos.forEach((p, i) => at.set(qk(p.x, p.y), i));
    // Candidate fold centres: bounding box and each row/column parity's own extent.
    const cands = (vals: number[], parity: (i: number) => number) => {
      const out = [mid(vals)];
      for (const par of [0, 1]) {
        const v = vals.filter((_, i) => parity(i) === par);
        if (v.length) out.push(mid(v));
      }
      return out;
    };
    const parityOf = (i: number) => (o === 'flat' ? cells[i]!.col : cells[i]!.row) & 1;
    const pairsFor = (cx: number, cy: number) => {
      const reflect = (x: number, y: number): [number, number] =>
        axis === 'lr' ? [2 * cx - x, y] : axis === 'tb' ? [x, 2 * cy - y] : [2 * cx - x, 2 * cy - y];
      const side = (x: number, y: number): number => {
        const d = axis === 'lr' ? x - cx : y - cy;
        if (Math.abs(d) > 1e-4) return d < 0 ? -1 : 1;
        if (axis !== 'rot') return 0;
        return x < cx - 1e-4 ? -1 : x > cx + 1e-4 ? 1 : 0;
      };
      const out: Array<[number, number]> = [];
      cells.forEach((_, i) => {
        const { x, y } = pos[i]!;
        if (side(x, y) !== -1) return;
        const [rx, ry] = reflect(x, y);
        const j = at.get(qk(rx, ry));
        if (j === undefined || side(pos[j]!.x, pos[j]!.y) !== 1) return;
        out.push([i, j]);
      });
      return out;
    };
    let best: Array<[number, number]> = [];
    const cxs = axis === 'tb' ? [mid(xs)] : cands(xs, parityOf);
    const cys = axis === 'lr' ? [mid(ys)] : cands(ys, parityOf);
    for (const cx of cxs) {
      for (const cy of cys) {
        const pr = pairsFor(cx, cy);
        if (pr.length > best.length) best = pr;
      }
    }
    const copied = new Set<string>();
    const pairs: Array<[Hex, Hex]> = [];
    for (const [i, j] of best) {
      const a = cells[i]!;
      const b = cells[j]!;
      const ka = key(a.col, a.row);
      const kb = key(b.col, b.row);
      if (copied.has(kb) || locked.has(ka) || locked.has(kb)) continue;
      copied.add(kb);
      pairs.push([a, b]);
    }
    const dest = new Set(pairs.map(([, b]) => key(b.col, b.row)));
    const from = new Map(pairs.map(([a, b]) => [key(a.col, a.row), b] as const));
    const next: TileToken[] = [];
    for (const tk of tokens) {
      // Wood on a hex about to be overwritten goes.
      if (dest.has(key(tk.col, tk.row)) && REPLACED_TOKENS.has(tk.type)) continue;
      next.push(tk);
    }
    for (const [a, b] of pairs) {
      t[b.row]![b.col] = t[a.row]![a.col]!;
    }
    for (const tk of tokens) {
      const b = from.get(key(tk.col, tk.row));
      if (b && REPLACED_TOKENS.has(tk.type)) next.push({ ...tk, col: b.col, row: b.row });
    }
    tokens = next;
  };

  const placeWood = (id: TerrainLayerId, type: TokenType, onTerrain: Terrain[]) => {
    const layer = cfg.layers[id];
    if (layer.amount <= 0) return;
    const same = new Set(tokens.filter((tk) => tk.type === type).map((tk) => key(tk.col, tk.row)));
    const pool = cells.filter(
      (h) =>
        !locked.has(key(h.col, h.row)) &&
        !woodCells.has(key(h.col, h.row)) &&
        allowed(layer.bias, h.col, h.row) &&
        onTerrain.includes(t[h.row]![h.col]!),
    );
    const n = Math.min(pool.length, Math.round((pool.length * layer.amount) / 100));
    for (let i = 0; i < n; i++) {
      const h = pickLinked(pool, layer, (x, y) => same.has(key(x, y)));
      tokens.push({ type, col: h.col, row: h.row });
      same.add(key(h.col, h.row));
      woodCells.add(key(h.col, h.row));
      placed[id] += 1;
    }
  };

  // Houses first so forest and trees fill around them.
  placeWood('houses', 'house', ['land', 'high']);
  placeWood('forest', 'forest', ['land', 'high']);
  placeWood('trees', 'tree', ['land', 'high']);
  placeWood('palisade', 'palisade', ['land', 'high', 'plateau']);
  // Grass fills what is left — it never covers forest, trees, houses or palisades.
  placeWood('grass', 'grass', ['land', 'high']);

  if (cfg.mirror !== 'off') {
    mirrorPass();
    // The copy changed the counts: tally what is really on the board.
    for (const id of TERRAIN_LAYER_IDS) placed[id] = 0;
    const byTerrain: Partial<Record<Terrain, TerrainLayerId>> = {
      water: 'water',
      high: 'hills',
      plateau: 'plateau',
      rock: 'mountain',
    };
    const byToken: Partial<Record<TokenType, TerrainLayerId>> = {
      forest: 'forest',
      tree: 'trees',
      grass: 'grass',
      palisade: 'palisade',
      house: 'houses',
    };
    for (const h of cells) {
      const id = byTerrain[t[h.row]![h.col]!];
      if (id) placed[id] += 1;
    }
    for (const tk of tokens) {
      const id = byToken[tk.type];
      if (id && inB(tk.col, tk.row)) placed[id] += 1;
    }
  }

  return { terrain: t, tokens, placed };
}

export function describePlaced(placed: Record<TerrainLayerId, number>): string {
  const parts = TERRAIN_LAYER_IDS.filter((id) => placed[id] > 0).map(
    (id) => `${placed[id]} ${TERRAIN_LAYER_LABEL[id].toLowerCase()}`,
  );
  return parts.length ? `Placed ${parts.join(', ')}.` : 'Nothing placed — raise an amount, or free up space.';
}
