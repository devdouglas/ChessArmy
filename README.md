# There Will Be Legions

Hex army-chess. Kill the enemy **General** (only if they fielded one), or every enemy piece. You are **Red**. Default is vs AI (Blue); **Hotseat** is two humans.

Rules live in `src/engine.ts`. Vite + SVG UI is throwaway.

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

## Units (stock)

Live numbers are editable in **Units**. PHP/`localStorage` override these.

| Chess  | Unit    | Move | Shoot | Notes                                                      | Value |
|--------|---------|------|-------|------------------------------------------------------------|-------|
| Pawn   | Soldier | 1    | 2     | Infantry (can be overrun). Stamina 1, regen 1              | 1     |
| Knight | Scout   | 2    | 3     | Water + through pieces. 2 actions; move cap 3. Stamina ends the 2nd action | 3 |
| Bishop | Bazooka | 1    | 4     | Splash (friendly fire); 2-turn shoot CD                    | 3     |
| Rook   | Sniper  | 1    | 6     | —                                                          | 5     |
| Queen  | Tank    | 3    | 3–4   | Overrun infantry; no high; splash FF; min range 3; armor 2 | 9     |
| King   | General | 1    | 2     | King (win piece); armor 1                                  | —     |
| —      | Tower   | *    | *     | Kit glyph only — set stats in Units                        | *     |

Click a piece: green = move, gold = stamina (double range or climb), red = legal shot. Dual hex: Shoot, or click again to move.

**Stamina:** once per turn, spend 1 to climb low→high and/or double that action's move range. Spending it on a multi-action unit (scout) ends the activation — no second action. Empty pool shows a bolt badge on the piece (top-right, above ammo). Regen is consecutive own turns per point; walking resets the countdown (that turn still counts). The point only lands on an **idle** End (no move). Regen 1 = sit one idle turn after walking. Regen 2 = two own turns, last one idle. 0 = never.

**Max units / turn** (Level panel in the Editor, default 1): that many pieces may activate before the side-turn ends. Played pieces get a green check. **End turn** below the board skips leftovers (also how you idle-regen when the cap is 1). AI uses the same quota. Scout’s 2 actions still happen inside one of those activations. Random maps stay at 1.

## Terrain

Random maps scatter water / rock / wall / high on the **mid belt** (rows 3–7). Saved levels paint the whole grid.

| Terrain | Walk                         | LOS                                      | Extra                                      |
|---------|------------------------------|------------------------------------------|--------------------------------------------|
| Land    | yes                          | open                                     | —                                          |
| Water   | scout only                   | open                                     | —                                          |
| Rock    | no                           | blocks                                   | permanent                                  |
| Wall    | no                           | blocks                                   | bazooka/tank splash demolishes             |
| High    | climb from low costs 1 stamina | from low: blocks. from high: over pieces | high→high free; shooter on high gets +1 range |

**Straight** shots: pieces block LOS from low ground. **Arch** shots: fire over units; terrain LOS (rock / wall / high) is unchanged. High shooters see along the ridge and over pieces either way; rock/wall still block.

Armor ring: **green** ≥2, **orange** 1, **red** 0, **purple** negative. Damage is `max(0, amount − armor)`. Melee floors at **1** even if armor would soak it; shots can still bounce off.

AI is aggressive: any legal shoot/melee first, otherwise close on your general (or nearest piece). It does not flee.

Start screen: **Campaign** / **vs AI** / **Hotseat** / **Tutorial**. Campaign and Tutorial walk saved maps of that category A–Z vs AI. **Start** in the toolbar returns here.

Saved levels have a category: `campaign` | `tutorial` | `free` (old saves → free) and **max units / turn** (old saves → 1). Set both in the Editor Level panel.

## Editors

- **Editor** — paint terrain, stamp armies, save levels, set category, max units / turn, and default level.
- **Units** — mutate stats live (move, shoot, HP, armor, ammo, splash, …). **Kit** sets icon + specials (water, overrun, high, king) without resetting numbers. Category: Modern / Roman / Greek (stock is Modern); filter the editor by era. New match to respawn ammo / HP. Catalog is `src/roster.ts`.
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
public/api.php    shared JSON store
vite.config.ts    php-cgi middleware, port 5174, base /warchess/
```
