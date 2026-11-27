/**
 * Game → sound mapping for There Will Be Legions. Keeps main.ts edits to one-liners.
 * Every id is an action id from the Legions sound studio (actions.json); ids without a pick stay silent.
 * Unit move / melee / ranged / death / rout use the studio's resolved per-unit map
 * (a unit type's own pick overrides, otherwise the default plays): see playUnitSfx in sfx.ts.
 */
import {
  hasSfx,
  initSfx,
  playSfx,
  playUnitSfx,
  setSfxMuted,
  setSfxVolume,
  sfxActionForUnit,
  sfxMuted,
  sfxVolume,
} from './sfx';

type PieceLike = { type: string };
type ActionLike = { kind: string; structure?: string };
type HitLike = { id: string; fatal?: boolean; routed?: boolean; dealt: number; armor?: number; ranged?: boolean };

// ---------- actions (start of playAnimatedAction) ----------
let actor: PieceLike | null = null;
let actorKind = '';
let meleePlayed = false;
/** Unit types of the pieces on the board when the action started (fatal hits may be gone afterwards). */
let typeSnapshot = new Map<string, string>();

const BUILD_SFX: Record<string, string> = {
  pikes: 'build_trap',
  palisade: 'build_palisade',
  bridge: 'build_bridge',
  remove: 'build_remove',
};

/** Called once per animated action (player or AI), before it animates. */
export function sfxAction(
  action: ActionLike,
  piece: PieceLike | null | undefined,
  pieces?: readonly { id: string; type: string }[],
): void {
  actor = piece ?? null;
  if (pieces) typeSnapshot = new Map(pieces.map((p) => [p.id, p.type]));
  actorKind = action.kind;
  meleePlayed = false;
  switch (action.kind) {
    case 'charge': playSfx('charge'); break;
    case 'lunge': playSfx('lunge'); break;
    case 'bash': playSfx('bash'); break;
    case 'berserk': playSfx('berserk'); break;
    case 'shields': playSfx('shields_up'); break;
    case 'reload': playSfx('reload'); break;
    case 'rotate': playSfx('unit_rotate'); break;
    case 'skip': playSfx('scout_skip'); break;
    case 'build': playSfx(BUILD_SFX[action.structure ?? ''] ?? 'build_remove'); break;
    default: break; // move / shoot: animateMoveAlong / animateShot play the unit's own sound
  }
}

/** Start of a step animation: a walk plays the unit's move sound, a bump (no path) its melee sound. */
export function sfxStep(piece: PieceLike, pathLength: number): void {
  if (pathLength > 0) {
    playUnitSfx(piece.type, 'move');
  } else {
    playUnitSfx(piece.type, 'melee');
    meleePlayed = true;
  }
}

/** A shot leaves: the unit's ranged sound now, impact when the projectile lands. */
export function sfxShot(piece: PieceLike, flightMs: number, splash: boolean): void {
  playUnitSfx(piece.type, 'ranged');
  playSfx(splash ? 'impact_splash' : 'impact_hit', { delayMs: flightMs });
}

/**
 * Hits flashing on the board (melee bumps, shot results, hazards).
 * typeOf resolves a piece id to its unit type (undefined if gone).
 */
export function sfxHits(hits: readonly HitLike[], typeOf: (id: string) => string | undefined): void {
  if (!hits.length) return;
  const meleeKinds = actorKind === 'move' || actorKind === 'charge' || actorKind === 'lunge' || actorKind === 'berserk' || actorKind === 'bash';
  if (actor && meleeKinds && !meleePlayed && hits.some((h) => !h.ranged)) {
    playUnitSfx(actor.type, 'melee');
    meleePlayed = true;
  }
  let soak = false;
  let damage = false;
  for (const h of hits.slice(0, 6)) {
    const type = typeOf(h.id) ?? typeSnapshot.get(h.id);
    if (h.routed) {
      if (type) playUnitSfx(type, 'rout');
      else playSfx('default_rout');
    } else if (h.fatal) {
      if (type) playUnitSfx(type, 'death');
      else playSfx('default_death');
    } else if (h.dealt > 0) {
      if ((h.armor ?? 0) > 0) soak = true;
      else damage = true;
    }
  }
  if (soak) playSfx('armor_soak');
  if (damage) playSfx('take_damage');
}

/** AP gold / blue pulses at turn start. */
export function sfxActionPoints(kind: 'gain' | 'spend'): void {
  playSfx(kind === 'gain' ? 'ap_gain' : 'ap_spend');
}

// ---------- state observer (called from render) ----------
type ObserveInfo = {
  screen: string;
  turn: string;
  turnNumber: number;
  winner: string | null;
  playerTurn: boolean;
  won: boolean;
  vsEnemy: boolean;
  turnsLeft: number | null;
};
let last: ObserveInfo | null = null;

export function sfxObserve(info: ObserveInfo): void {
  const prev = last;
  last = { ...info };
  if (!prev || info.screen !== 'play' || prev.screen !== 'play') return;
  if (info.winner && !prev.winner) {
    if (info.vsEnemy) playSfx(info.won ? 'victory' : 'defeat');
    return;
  }
  if (info.winner) return;
  if (info.turn !== prev.turn || info.turnNumber !== prev.turnNumber) {
    playSfx(info.playerTurn ? 'turn_start_player' : 'turn_start_enemy', { delayMs: 120 });
  }
  if (info.turnsLeft !== prev.turnsLeft && info.turnsLeft !== null && info.turnsLeft > 0 && info.turnsLeft <= 2) {
    playSfx('turn_limit_warning', { delayMs: 250 });
  }
}

/** Death sound for a unit type from its own action list (unit pick), used where only the type is known. */
export function sfxDeathAction(type: string): string {
  return sfxActionForUnit(type, ['death_animal', 'death_machine', 'death_dummy']) ?? 'death_human';
}

// ---------- buttons: one delegated listener ----------
const BUTTON_SFX: [string, string][] = [
  ['#end-turn', 'end_turn'],
  ['#briefing-go', 'briefing_go'],
  ['#popup-audio', 'popup_audio_toggle'],
  ['#scout-regen', 'scout_regen_map'],
  ['[data-scout-place]', 'scout_place'],
  ['#random-setup-go', 'random_setup_confirm'],
  ['#end-rogue-next', 'rogue_next_battle'],
  ['[data-rogue-buy]', 'rogue_buy'],
  ['#new-map, #start-hotseat, #end-rematch, #end-next, #end-rogue-retry, [data-play-level]', 'match_start'],
  ['[data-start], [data-pick-map]', 'mode_select'],
  ['button.period-pick[data-period]', 'era_select'],
  ['#board-close, #board-cancel, #random-setup-cancel, #rogue-promo-cancel, #map-pick-back, #story-cancel, #tts-cancel', 'menu_close'],
  ['[data-action-mode]', 'action_choice_popup'],
];

let lastHover: Element | null = null;
let installed = false;

/** Install once (idempotent): click / hover sounds for buttons, mute + volume controls, manifest preload. */
export function installSfx(root: HTMLElement): void {
  initSfx();
  if (installed) return;
  installed = true;
  root.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element | null;
      const btn = t?.closest?.('button');
      if (!btn || (btn as HTMLButtonElement).disabled) return;
      if (btn.id === 'sfx-mute') return; // the mute toggle itself stays quiet
      for (const [sel, id] of BUTTON_SFX) {
        if (btn.matches(sel) && hasSfx(id)) {
          playSfx(id);
          return;
        }
      }
      playSfx('ui_click');
    },
    true,
  );
  root.addEventListener(
    'pointerover',
    (e) => {
      const btn = (e.target as Element | null)?.closest?.('button');
      if (btn === lastHover) return;
      lastHover = btn ?? null;
      if (btn && !(btn as HTMLButtonElement).disabled && (e as PointerEvent).pointerType === 'mouse') playSfx('ui_hover', { gain: 0.6 });
    },
    true,
  );
  root.addEventListener('click', (e) => {
    const btn = (e.target as Element | null)?.closest?.('#sfx-mute');
    if (!btn) return;
    setSfxMuted(!sfxMuted());
    paintSfxControls();
    if (!sfxMuted()) playSfx('ui_click');
  });
  root.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement | null;
    if (el?.id !== 'sfx-volume') return;
    setSfxVolume(Number(el.value) / 100);
    if (sfxMuted() && Number(el.value) > 0) setSfxMuted(false);
    paintSfxControls();
  });
  root.addEventListener('change', (e) => {
    if ((e.target as HTMLElement | null)?.id === 'sfx-volume') playSfx('ui_click');
  });
}

function speakerIcon(on: boolean): string {
  const waves = on
    ? '<path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    : '<path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/>${waves}</svg>`;
}

/** Toolbar control: mute toggle + volume slider (saved in localStorage). */
export function sfxControlsHtml(): string {
  const on = !sfxMuted();
  const vol = Math.round(sfxVolume() * 100);
  return `<span class="sfx-controls">
    <button type="button" id="sfx-mute" class="sfx-mute${on ? ' on' : ''}" aria-pressed="${on ? 'true' : 'false'}" title="${on ? 'Sound effects on (click to mute)' : 'Sound effects muted (click to unmute)'}" aria-label="${on ? 'Mute sound effects' : 'Unmute sound effects'}">${speakerIcon(on)}</button>
    <input type="range" id="sfx-volume" class="sfx-volume" min="0" max="100" step="5" value="${vol}" title="Sound effects volume ${vol}%" aria-label="Sound effects volume">
  </span>`;
}

function paintSfxControls(): void {
  const btn = document.getElementById('sfx-mute');
  const slider = document.getElementById('sfx-volume') as HTMLInputElement | null;
  const on = !sfxMuted();
  if (btn) {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('title', on ? 'Sound effects on (click to mute)' : 'Sound effects muted (click to unmute)');
    btn.setAttribute('aria-label', on ? 'Mute sound effects' : 'Unmute sound effects');
    btn.innerHTML = speakerIcon(on);
  }
  if (slider) slider.title = `Sound effects volume ${Math.round(sfxVolume() * 100)}%`;
}
