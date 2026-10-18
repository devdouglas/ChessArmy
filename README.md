# Chess Army

Hex army-chess. Kill the enemy **General**. You are **Red**. Default is vs AI (Blue); **Hotseat** is two humans.

Rules live in `src/engine.ts`. Vite + SVG UI is throwaway.

## Run

Needs **Node** and **php-cgi** on `PATH` (Homebrew `php` ships it).

```bash
npm install
npm run dev
```

Open **http://localhost:5174/warchess/**

Vite executes `*.php` via php-cgi. Toolbar should say **server**, not **local only**. Port **5174** is pinned (`strictPort`). Base path is `/warchess/` so a production drop-in is `https://host/warchess/`.

```bash
npm run build    # dist/, including api.php
npm run preview  # same PHP middleware against dist/
```

Without php-cgi the board still runs; saves stay in `localStorage` and the badge reads **local only**.

## Units (stock)

Live numbers are editable in **Units**. PHP/`localStorage` override these.

| Chess  | Unit    | Move | Shoot | Notes                                                      | Value |
|--------|---------|------|-------|------------------------------------------------------------|-------|
| Pawn   | Soldier | 1    | 2     | Sprint once (move 2); shooting spends it                   | 1     |
| Knight | Scout   | 2    | 3     | 2 actions; move budget 3 so 1+1 / 2+1 / 1+2, not 2+2       | 3     |
| Bishop | Bazooka | 1    | 4     | Splash (friendly fire); 2-turn shoot CD                    | 3     |
| Rook   | Sniper  | 1    | 6     | —                                                          | 5     |
| Queen  | Tank    | 3    | 3–4   | Overrun infantry; splash FF; min range 3; armor 2          | 9     |
| King   | General | 1    | 2     | Win condition; armor 1                                     | —     |

Click a piece: gold = move, orange = sprint, red = legal shot, faded red = in range but not a shot. Ambiguous hexes ask Move vs Shoot.

## Terrain

Random maps scatter water / rock / wall / high on the **mid belt** (rows 3–7). Saved levels paint the whole grid.

| Terrain | Walk                         | LOS                                      | Extra                                      |
|---------|------------------------------|------------------------------------------|--------------------------------------------|
| Land    | yes                          | open                                     | —                                          |
| Water   | scout only                   | open                                     | —                                          |
| Rock    | no                           | blocks                                   | permanent                                  |
| Wall    | no                           | blocks                                   | bazooka/tank splash demolishes             |
| High    | climb from low costs −1 move | from low: blocks. from high: over pieces | high→high free; shooter on high gets +1 range |

Pieces also block LOS from low ground. High shooters see along the ridge and over pieces; rock/wall still block.

Armor ring: **green** ≥2, **orange** 1, **red** 0, **purple** negative. Damage is `max(0, amount − armor)`.

AI is greedy: captures by material, then walks toward your general.

## Editors

- **Editor** — paint terrain, stamp armies, save levels, set default level.
- **Units** — mutate stats live (move, shoot, HP, armor, ammo, splash, …). New match to respawn sprint / ammo / HP.
- Formations — saved army presets; Blue gets the layout flipped. Default formation is used on random maps and on levels with no stamped armies.

## Shared store

`public/api.php` reads/writes `public/data.json`: units, levels, formations, default IDs.

- `GET /warchess/api.php` → JSON store
- `POST` with header `X-Warchess-Key: warchess-oneshot` overwrites it (512 KB cap)

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
