/**
 * Small sound-effect player for There Will Be Legions.
 *
 * Clips come from public/data/sfx/ (synced there by the Legions sound studio,
 * ~/htdocs/ChessArmy-tools/legions-studio): manifest.json + <action id>.mp3.
 * - Web Audio: clips are fetched + decoded once and cached; play() never blocks.
 * - The same clip may overlap (max MAX_VOICES at once) but fast repeats inside
 *   MIN_GAP_MS are dropped, so a volley of hits does not turn into noise.
 * - Master volume + mute are saved in localStorage.
 * - Anything missing (manifest, file, decode, no AudioContext) fails silently.
 * - Debug: localStorage 'chessarmy-sfx-debug' = '1' logs every play() call to the console.
 */

export type SfxSlot = 'move' | 'melee' | 'ranged' | 'death' | 'rout';

type UnitSlotEntry = { file: string | null; source?: 'unit' | 'default'; action?: string };
export type SfxManifest = {
  generated?: string;
  /** action id → file name inside data/sfx/ (only picked actions). */
  actions: Record<string, string>;
  /** unit type → slot → resolved file (unit's own pick, else the default). */
  units?: Record<string, Partial<Record<SfxSlot, UnitSlotEntry>>>;
  /** action id → unit types that action covers (from the studio's actions.json). */
  unitActions?: Record<string, string[]>;
};

const VOLUME_KEY = 'chessarmy-sfx-volume';
const MUTE_KEY = 'chessarmy-sfx-muted';
const DEBUG_KEY = 'chessarmy-sfx-debug';
const MIN_GAP_MS = 45;
const MAX_VOICES = 3;

const base = `${import.meta.env.BASE_URL}data/sfx/`;

let manifest: SfxManifest | null = null;
let manifestLoading: Promise<SfxManifest | null> | null = null;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const lastPlayed = new Map<string, number>();
const voices = new Map<string, number>();

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

let volume = Math.min(1, Math.max(0, readNumber(VOLUME_KEY, 0.7)));
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

function debugOn(): boolean {
  try {
    return localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

function debug(...args: unknown[]): void {
  if (debugOn()) console.log('[sfx]', ...args);
}

function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
    master = null;
  }
  return ctx;
}

/** Browsers start audio suspended until a user gesture; resume on the first one. */
function unlockOnGesture(): void {
  const unlock = () => {
    const c = audioContext();
    if (c && c.state === 'suspended') void c.resume().catch(() => {});
  };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  }
}

export function loadSfxManifest(): Promise<SfxManifest | null> {
  if (manifest) return Promise.resolve(manifest);
  if (manifestLoading) return manifestLoading;
  manifestLoading = fetch(`${base}manifest.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((m: unknown) => {
      const ok = !!m && typeof m === 'object' && typeof (m as SfxManifest).actions === 'object';
      manifest = ok ? (m as SfxManifest) : { actions: {} };
      debug('manifest', Object.keys(manifest.actions).length, 'clips');
      preloadAll();
      return manifest;
    })
    .catch(() => {
      manifest = { actions: {} };
      return manifest;
    });
  return manifestLoading;
}

function decode(file: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(file);
  if (cached) return cached;
  const c = audioContext();
  const p: Promise<AudioBuffer | null> = !c
    ? Promise.resolve(null)
    : fetch(`${base}${encodeURIComponent(file)}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => c.decodeAudioData(data))
        .catch(() => null);
  buffers.set(file, p);
  return p;
}

function preloadAll(): void {
  if (!manifest) return;
  const files = new Set<string>(Object.values(manifest.actions));
  for (const slots of Object.values(manifest.units ?? {})) {
    for (const e of Object.values(slots)) if (e?.file) files.add(e.file);
  }
  for (const f of files) void decode(f);
}

function playFile(file: string, label: string, gain = 1): void {
  if (muted || volume <= 0) return;
  const now = performance.now();
  const last = lastPlayed.get(file) ?? -Infinity;
  if (now - last < MIN_GAP_MS) return;
  if ((voices.get(file) ?? 0) >= MAX_VOICES) return;
  lastPlayed.set(file, now);
  const c = audioContext();
  if (!c || !master) return;
  if (c.state === 'suspended') void c.resume().catch(() => {});
  debug('play', label, file);
  void decode(file).then((buf) => {
    if (!buf || !master || !ctx) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      let node: AudioNode = src;
      if (gain !== 1) {
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(g);
        node = g;
      }
      node.connect(master);
      voices.set(file, (voices.get(file) ?? 0) + 1);
      src.onended = () => voices.set(file, Math.max(0, (voices.get(file) ?? 1) - 1));
      src.start();
    } catch {
      /* silent */
    }
  });
}

/** Has this action a picked clip? */
export function hasSfx(id: string): boolean {
  return !!manifest?.actions[id];
}

/** Play an action's picked clip. Actions without a pick stay silent. */
export function playSfx(id: string, opts: { delayMs?: number; gain?: number } = {}): void {
  const go = () => {
    const file = manifest?.actions[id];
    if (file) playFile(file, id, opts.gain);
    else debug('silent (no pick)', id);
  };
  if (!manifest) {
    void loadSfxManifest().then(() => (opts.delayMs ? window.setTimeout(go, opts.delayMs) : go()));
    return;
  }
  if (opts.delayMs) window.setTimeout(go, opts.delayMs);
  else go();
}

/**
 * Unit move / melee / ranged / death / rout: the unit type's own pick when it has one, otherwise the default
 * (resolved by the studio in manifest.units). Unknown unit types fall back to default_<slot>.
 */
export function playUnitSfx(type: string, slot: SfxSlot, opts: { delayMs?: number } = {}): void {
  const go = () => {
    const entry = manifest?.units?.[type]?.[slot];
    const file = entry?.file ?? manifest?.actions[`default_${slot}`];
    if (file) playFile(file, `${type}:${slot}`);
    else debug('silent (no pick)', `${type}:${slot}`);
  };
  if (!manifest) {
    void loadSfxManifest().then(go);
    return;
  }
  if (opts.delayMs) window.setTimeout(go, opts.delayMs);
  else go();
}

/** First action in `ids` that covers this unit type (per the studio's unit lists), else null. */
export function sfxActionForUnit(type: string, ids: readonly string[]): string | null {
  const ua = manifest?.unitActions;
  if (!ua) return null;
  for (const id of ids) if (ua[id]?.includes(type)) return id;
  return null;
}

export function sfxMuted(): boolean {
  return muted;
}

export function sfxVolume(): number {
  return volume;
}

export function setSfxMuted(on: boolean): void {
  muted = on;
  try {
    localStorage.setItem(MUTE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (master) master.gain.value = muted ? 0 : volume;
}

export function setSfxVolume(v: number): void {
  volume = Math.min(1, Math.max(0, v));
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    /* ignore */
  }
  if (master) master.gain.value = muted ? 0 : volume;
}

let started = false;
/** Call once at startup: loads the manifest and arms the autoplay unlock. */
export function initSfx(): void {
  if (started) return;
  started = true;
  unlockOnGesture();
  void loadSfxManifest();
}
