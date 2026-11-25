# There Will Be Legions

Hex Warfare. Kill the enemy **General** (only if they fielded one), wipe the army, or hold every **flag**. You are usually **Red**. Default is vs AI (Blue); **Hotseat** (from inside a match) is two humans.

Full rules, roster, and play modes: [`GAME_OVERVIEW.md`](GAME_OVERVIEW.md). Rules also live in `src/engine.ts`. Vite + SVG UI is throwaway.

## Run

Needs **Node** and **php-cgi** on `PATH` (Homebrew `php` ships it).

```bash
npm install
npm run dev
```

Open **http://localhost:5174/warchess/**

Vite executes `*.php` via php-cgi. Version number shows a **green** dot when the store is up, **red** when offline. Port **5174** is pinned (`strictPort`). Base path is `/warchess/` so a production drop-in is `https://host/warchess/`.

```bash
npm run build    # dist/, including api.php
npm run preview  # same PHP middleware against dist/
```

Without php-cgi the board still runs; saves stay in `localStorage` and the version dot stays red.

## Play modes

Home screen, filtered by era (**Ancient** / **Modern** / **Futuristic**). Modern and Futuristic are marked under construction. Legacy Roman / Greek categories map to Ancient.

- **Anthony's Lessons** (Tutorial) — always open if the era has tutorial maps. Finish one to unlock the next.
- **Campaign**, **Historical Battle**, **Skirmish vs AI** — locked until every tutorial map in this era is cleared.
- **Randomised Battle** and **Roguelite** — unlock after 10 tutorial wins in this era (or all of them, if the era has fewer than 10).
- **Editor**, plus **Reset progress**.

**Roguelite** is a 10-battle run on generated maps: starts 2v2, permanent player losses, both sides gain a recruit after each win.

## Units (stock Modern)

Live numbers are editable in **Units**. PHP/`localStorage` override these. Ancient and Futuristic stock units are in `GAME_OVERVIEW.md`.

| Chess  | Unit    | Move | Shoot | Notes                                                      | Value |
|--------|---------|------|-------|------------------------------------------------------------|-------|
| Pawn   | Soldier | 1    | 2     | Infantry (can be overrun). Energy 1, regen 1               | 1     |
| Knight | Scout   | 2    | 3     | Water + through pieces. 2 actions; move cap 3. Energy extra comes after those actions | 3 |
| Bishop | Bazooka | 1    | 4     | Splash (friendly fire); 2-turn shoot CD                    | 3     |
| Rook   | Sniper  | 1    | 6     | —                                                          | 5     |
| Queen  | Tank    | 3    | 4     | Overrun infantry; no climb; splash FF; min range 3; armor 2 | 9     |
| King   | General | 1    | 2     | Command piece; armor 1                                     | 100   |
| —      | Tower   | *    | *     | Kit glyph only — set stats in Units                        | *     |

Click a piece: green = move, gold = energy (climb or extra move), red = legal shot. Dual hex: Shoot, or click again to move.

**Energy** (player-facing name; the code field is still `stamina`): spend 1 to climb, to stay in water at turn start, or after every action point is spent take a second straight-line action (new direction OK). Scout's extra actions are used first; the energy extra is last. Empty pool shows a bolt badge on the piece. Regen is consecutive own turns per point; any action resets the countdown (that End still counts). The point only lands if the unit did **nothing** that turn (**Rest** counts as idle), **on land** — never in water. 0 = never.

**Max units / turn** (Level panel in the Editor, default 1): that many pieces may activate before the side-turn ends. Played pieces get a green check. **End turn** below the board skips leftovers (also how you idle-regen when the cap is 1). AI uses the same quota. Scout's 2 actions still happen inside one of those activations. Randomised battles and Roguelite use **6**.

## Terrain

Randomised maps are **13×11**, **flat-top**, and scatter water / mountain / palisade / hill / plateau on the **mid belt** (not the army ranks). Saved levels paint the whole grid. Editor default is **11×11**, **pointy-top**.

| Terrain | Height | Walk | LOS |
|---------|--------|------|-----|
| Land | 0 | yes | open |
| Water | 0 | if the unit can enter water | open |
| Hill | 1 | climb (costs 1 energy) | from low: blocks; ridge-to-ridge open over pieces |
| Plateau | 2 | climb | same idea, higher |
| Mountain | 3 | climb if climb level allows | blocks |
| Wall | 0 | no | blocks; splash can demolish |

**Straight** shots: pieces, palisades and forest block from low. **Arch** shots: fire over units, palisades and forest; rock / wall / higher ground still block. Shooter elevation adds range; a high **target** costs that much extra.

Armor ring / hex: **−2** red, **−1** orange, **0** green, **+1** blue, **+2** purple. Damage is `max(0, amount − armor)` for shots (shots ignore negative armor). Melee floors at **1** even if armor would soak it.

AI personalities: **aggressive** (default), **defensive**, **advance**. Per-colour, set on the level or in the randomised-battle popup. Checklist toggles live in Editor → AI.

Saved levels have a category: `campaign` | `tutorial` | `historical` | `skirmish` (old saves `free` → historical) and **max units / turn** (old saves → 1). Set these in the Editor Level panel.

## Editors

- **Editor** — paint terrain, stamp armies, save levels, set category, max units / turn, and default level.
- **Units** — mutate stats live (move, shoot, HP, armor, ammo, splash, …). **Kit** sets icon + pathing specials without resetting numbers. Category: Ancient / Modern / Futuristic; filter the editor by era. New match to respawn ammo / HP. Catalog is `src/roster.ts`.
- Formations — saved army presets; Blue gets the layout flipped. Default formation is used on random maps and on levels with no stamped armies.

## Shared store

`public/api.php` reads/writes `public/data.json`: units, levels, formations, default IDs.

- `GET /warchess/api.php` → JSON store
- `POST` with header `X-Warchess-Key: warchess-oneshot` overwrites it (2 MB cap)

The client pulls on boot, then debounced-pushes on every persist. Empty server + local data seeds the file. Key is in `public/api.php` (`$SAVE_KEY`) and `src/sync.ts`.

## Layout

```
src/engine.ts     rules
src/hex.ts        hex math / pathing / LOS helpers
src/ai.ts         greedy AI
src/map.ts        spawn + random terrain
src/levels.ts     saved maps
src/formations.ts army presets
src/units.ts      live stats + localStorage
src/sync.ts       PHP pull/push
src/main.ts       UI
src/roguelite.ts  Roguelite run
public/api.php    shared JSON store
vite.config.ts    php-cgi middleware, port 5174, base /warchess/
```
