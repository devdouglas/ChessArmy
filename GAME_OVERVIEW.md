# There Will Be Legions — game overview

Hex army-chess. Kill the enemy **General** (only if they fielded one), wipe the army, or hold every **flag**. Four colours. You are usually **Red**.

Stock numbers below are the built-in roster. **Units** can override them live; a new match respawns ammo and HP.

---

## Play modes

Home screen, filtered by era (**Ancient** / **Modern** / **Futuristic**). Modern and Futuristic are marked under construction.

| Option | What it does |
|--------|----------------|
| **Campaign** | Saved campaign maps vs AI, editor order. Win one to unlock the next. Locked until Tutorial is finished. |
| **Tutorial** | Same lockstep vs AI. Always open (if the era has tutorial maps). |
| **Historical Battle** | Historical maps in editor order, vs AI, no lock. Locked until Tutorial is finished. |
| **Skirmish vs AI** | Pick a skirmish map, or Randomised map at the bottom of the list. Locked until Tutorial is finished. |
| **Randomised Battle** | Skip the list. Setup popup, then a generated map vs AI. Locked until Tutorial is finished. |
| **Editor** | Levels, units, AI checklist. |

**Start hotseat** (in-match, next to Restart level): same map, both sides human, no AI. Page background tints to the active colour on each turn switch.

**Reset progress** clears tutorial + campaign wins (and their best stars).

---

## Winning

A side is out if:

- every piece is dead (**wipeout**), or
- they fielded a General and **all** Generals on that side are dead (**command**), or
- **max turns** ran out (the other side wins).

If **flags** are on the map, holding **all** of them also wins.

Teams: **player** and **ai-ally** colours fight together against **ai-enemy**. Default: Red player, Blue/Yellow/Purple AI enemies.

---

## Board and turns

- Hex grid. Editor default **11×11**, **pointy-top**. Grid size **5–21**.
- Randomised maps: **13×11**, always **flat-top**.
- A side activates up to **units per turn** pieces, then the turn passes. Played pieces get a check. **End turn** skips leftovers (also how you idle-regen when the cap is 1).
- Saved maps set their own cap (default 1). Randomised battles use **6**.
- **Max turns** (0 = none) counts full rounds, same clock as stars.
- Select a piece: **green** move, **gold** stamina, **red** shot. Dual hex: **Shoot**, or click again to move. Empty shoot-range shows a white transparent crosshair.
- **Rest** — idle this activation (regen).
- **Skip** — scout leftover action.
- **Turn** (hex-armor units) — face a new hex without walking.

---

## Movement and combat

**Move** is a straight-line range. Standing on a hill/plateau/mountain adds **+1 / +2 / +3**. **Move cap** limits total steps this activation (0 = none; scout stock 3). Height only changes **±1** per step. **Climb level** is the max occupiable height (0 land … 3 mountain).

**Stamina** (pool):

- Spend 1 to **climb**, to **stay in water** at turn start, or after **every action point** is spent take a **second straight-line** action (new direction OK). Unused steps of an action are lost. Units with extra actions (scout) use those first; stamina extra is last.
- Climbing or entering water ends momentum (no chained extra action through that hex).
- Empty pool: bolt badge on the piece.
- **Regen**: consecutive own turns per point. Any action resets the countdown (that End still counts). The point only lands if the unit did **nothing** that turn (**Rest** counts as idle), **on land** — never in water. 0 = never.

**Water:**

- Entering from land ends the activation. From water: **1 hex** per action, cannot shoot.
- Turn start in water: **−1 stamina** (not an action), or **2 HP** if you cannot pay. Leftover stamina can still buy an extra 1-hex. No regen in water.

**Melee:** bump an occupied hex. A kill takes the spot; otherwise stop on the hex before. **0 melee** cannot bump. Melee damage floors at **1** even if armor would soak it.

**Charge** (1+): damage every unit you walk through (armor applies, including negative). A living blocker stops you unless that hit would kill them (same as palisade). Empty dest beyond: pass through and damage survivors. Palisades: you do not pass unless the melee hit **breaks** them. Forest: walk through; **cannot charge through**.

**Shoot:** range 0 = cannot shoot. Shooter elevation **+range**; a high **target** costs that much extra. **Min range**. **Straight** = pieces (and palisades / forest) block from low. **Arch** = fire over units, palisades and forest; rock / wall / higher ground still block. **Reload** = own turns you cannot shoot after firing. **Ammo** 0 = unlimited. Shots into forest chip the trees (3 HP); the occupant is unharmed until the wood is gone. Occupants can still shoot out.

**Splash** (bazooka / tank / catapult / bomber / dreadnought stock): rocket blast, friendly fire. Cannot impact on open water.

**Armor** −2…+2, subtracted from incoming damage (shots ignore negatives). Ring / hex: −2 red, −1 orange, 0 green, +1 blue, +2 purple. Stock: tank/dreadnought +2, general/elephant/cruiser +1.

**Hex armor:** per-face armor. A **−2** face cannot be walked or shot (those hexes are not legal dests or fire targets) — Experimental features, two toggles, both on by default. Facing is a first-class action for these units.

**Rout:** the unit breaks (any leftover HP), shake + dissolve. **Generals never rout** (unit type or General token). Triggers when an **enemy stands on the exact opposite hex** and **one of those two faces is −2 (red)**. Friends and terrain never pin.

**Hex damage:** per-face 0–2. Each live face is facing pikes on the **adjacent** hex only: enemies take that damage when they **enter**. Standing there does not pulse again.

**Pass through pieces** (scout / horse archer / some flyers): walk through units. **Infantry** can be overrun by kits that allow it (tank).

**Can hide:** invisible to enemies while on a hide token (forest). Owner still sees them. Moving, attacking, or taking a hit breaks hide for the rest of the match. Stock **Barbarian** has this on.

**Value/weight** is AI scoring. A General token on a piece is **+1** HP, **+1** stamina, and **+1** value.

---

## Terrain

| Terrain | Height | Walk | LOS |
|---------|--------|------|-----|
| Land | 0 | yes | open |
| Water | 0 | if the unit can enter water | open |
| Hill | 1 | climb | from low: blocks; ridge-to-ridge open over pieces |
| Plateau | 2 | climb | same idea, higher |
| Mountain | 3 | climb if climb level allows | blocks |
| Wall | 0 | no | blocks; splash can demolish |

Editor paints the whole grid. Click a placed unit to turn it one hex face (saved on the stamp). Random maps scatter features on the **mid belt** (not the army ranks).

---

## Tokens

| Token | Effect |
|-------|--------|
| **Pikes** | 1 damage to enemies that **enter** the hex. |
| **Wall** | Impassable, blocks LOS, splash-breakable. |
| **House** | Same as wall, house graphic. Paint onto a unit in the editor to garrison them at kickoff. Occupant can shoot out and leave; after they exit, nobody can enter. |
| **Palisade** | Fence, **3 HP**. Melee/charge/splash chip it. Random maps use these instead of walls. |
| **Tree** | Same as palisade, tree graphic. |
| **Forest** | Three trees, no hex fill/stroke. Walkable cover — units render behind the trees. Incoming shots chip the wood (3 HP, same as palisade); occupant unharmed until felled. Shoot out OK. Charge cannot pass through. **Can hide** units are invisible to enemies here until they move, attack, or are hit. |
| **Flag** | Capture by standing on it. All flags held = win. Seeded owner if a piece starts on it. |
| **Board** | Message sign. First friendly walk pops the text; later walks do not. Click the hex to reread. Editor: click to set the message. |
| **Do not touch** | AI will not walk this hex (standalone, or painted onto another token). |

**Unit token — General:** stamp on a piece so it counts as a command piece (star). **+1 HP**, **+1 stamina**, **+1** value. All generals on a side must fall to lose by command.

**Unit token — Hidden:** starts the match invisible to enemies (any hex). Same reveal rules as **Can hide**: moving, attacking, or taking a hit breaks it for the rest of the match. Owner still sees them. AI always camps while concealed — no walking until they can shoot/melee, or until they are provoked (hit → revealed). If a side's remaining pieces are all still hidden, they all break cover; an AI side then switches to **aggressive**. If every living piece on the board is hidden, everyone unhides.

---

## Stock roster

Live in **Units**. Kit sets icon + pathing through pieces / infantry; **water** and **climb** are per-unit.

### Ancient

| Unit | Move | Shoot | Notes | Val |
|------|------|-------|-------|-----|
| Archer | 1 | 4 arch, min 2 | | 3 |
| Javelin | 1 | 2 arch | glyph kit | 2 |
| Horse archer | 2 | 3 arch | through pieces | 4 |
| Chariot archer | 2 | 3 arch | charge 1, HP 2, no water, climb hill only | 5 |
| Cohort | 1 | 1 arch | HP 2, hex armor | 2 |
| Hoplite | 1 | — | HP 2, hex armor | 2 |
| Elephant | 2 | — | HP 3, melee 2, charge 1, armor 1, no climb | 8 |
| Barbarian | 2 | — | HP 2, melee 2, charge 1, stamina 2, can hide | 3 |
| Peasant | 1 | — | | 0 |
| Catapult | 1 | 5 arch, min 2 | melee 0, splash, CD 2, no climb | 6 |

### Modern

| Unit | Move | Shoot | Notes | Val |
|------|------|-------|-------|-----|
| Soldier | 1 | 2 | infantry, stamina 1 / regen 1 | 1 |
| Scout | 2 | 3 | water, through pieces, 2 actions, move cap 3 | 3 |
| Bazooka | 1 | 4 | splash, CD 2 | 3 |
| Sniper | 1 | 6 | | 5 |
| Tank | 3 | 4, min 3 | overrun infantry, no climb, splash, armor 2, charge 1 | 9 |
| General | 1 | 2 | command piece, armor 1 | 100 |
| Tower | 1 | 2 | glyph kit | 1 |
| Dummy | 0 | — | HP 2, rooted | 0 |

### Futuristic

Flyers: climb mountain, water OK. Some pass through pieces (fighter, gunship, frigate).

| Unit | Move | Shoot | Notes | Val |
|------|------|-------|-------|-----|
| Fighter | 3 | 2 | charge 1, through pieces | 3 |
| Gunship | 2 | 3 arch | through pieces | 4 |
| Bomber | 1 | 4 arch, min 2 | splash, CD 2 | 5 |
| Frigate | 2 | 2 | HP 2, charge 1, through pieces | 4 |
| Cruiser | 2 | 3 | HP 3, armor 1 | 7 |
| Dreadnought | 1 | 4, min 2 | HP 4, armor 2, splash, no stamina | 10 |

**Copy** a unit to make a custom id (`u-…`): rename, recategorize, switch kit. Delete copies only.

---

## Randomised maps

Generated on the 13×11 flat-top belt:

| Feature | Default count | Notes |
|---------|---------------|--------|
| Water | 8 | 7× cluster; 3× more likely on left/right flanks |
| Mountain | 4 | 7× cluster |
| Palisade | 3 | overlay on walkable land; same flank bias as water |
| Hill | 6 | 7× cluster |
| Plateau | 5 | 7× cluster |

**Setup popup** (home **Randomised Battle**, or Randomised map under Skirmish / Hotseat): pick **your army**, **enemy army** (era presets; Modern also has **Standard**), and **enemy AI** (hidden in hotseat). Those stamps load onto the generated map. Rematch / New map keep the last picks. **6 units/turn**.

Teaser on the map tile: *Choose your army and your opponent. Now go to war!*

---

## Stars and progress

Star 1 = win. Stars 2 and 3 are per-map rules (editor): **turns** or **casualties**, with `<` / `≤` / `=`, value 0–99.

Stock defaults: star 2 = turns **< 6**, star 3 = **0 casualties**.

Finish screen: this run (big stars) and **Best on this map**. Best is stored in the browser, only goes up. Old clears migrate as 1★. Randomised battles have no saved map, so no best.

Campaign / tutorial unlock is still win/not-win.

---

## AI

Per colour: **aggressive** (default), **defensive**, **advance**. Set on the level, or in the randomised-battle popup (enemy army).

Checklist (Editor → AI) toggles every behaviour per personality. Attacking when a shot or melee is legal is always on.

| Personality | Stock idea |
|-------------|------------|
| **Aggressive** | Most rules on. **Attack** hunts the enemy general (else nearest). **Hold** does **not** freeze them while Attack is on. |
| **Defensive** | Same column, typically mixed toward hold / high ground / no Attack. |
| **Advance** | Walk the **far edge** as a line. Rear steps first. Nobody outruns the slowest mover by more than **one hex**. Attacks still happen. Attack / Hold / flags / return-to-start off. |

Rules (short):

- **Shoot first** — dual choice: shoot vs melee.
- **Strongest first** — highest-value victim vs closest.
- **Attack** — close on enemy general / nearest.
- **Advance the front** — hunt the far board edge in this file.
- **Guard owned flags** — treat held flags like the king.
- **Value / weight scoring**
- **Close on the hunt** / **Do not flee**
- **Keep the line** — rear first, slack 1.
- **Avoid pikes** / **Never walk Do-not-touch**
- **Prefer high ground** — ridge route to the hunt; else a hill within 3.
- **Return to start** — when not hunting.
- **Targets defenses** — shoot/melee wall or palisade on the hunt path.
- **General does not dump into the army** — only the enemy general, or someone already in melee with him.
- **Never capture flags** — unless that move hits the enemy general.
- **Hold position** — when Attack is off: stay put, turn toward the nearest enemy. A ranged hit makes them move and try to attack that unit.
- **Activate the general last**
- **Avoid skipping**
- **Break palisades**

Stuck units (move 0 / no legal step) do not freeze an Advance line.

**Hidden camp** is not a checklist toggle. Concealed AI pieces ignore personality until they can attack or lose hide. Last-hidden-army flush (above) then plays aggressive.

---

## Armies and formations

Four sides: Red, Blue, Yellow, Purple.

Controllers: **player**, **ai enemy**, **ai ally**.

**Formations** are era-tagged army presets (piece + offset). Blue gets the layout flipped. Listed as piece count · combat value. **Standard** (Modern) is the stock chess-army setup. Default formation is used on random maps and on levels with **no** stamped armies.

---

## Level editor

Paint terrain, walls/palisades/trees/forest/pikes/flags/do-not-touch, stamp units and General tokens, erase.

Per level:

- Name, era, category (Campaign / Tutorial / Skirmish / Historical)
- Size, orientation (pointy / flat)
- Units per turn, max turns
- Teaser (120 chars) — map lists, under the title
- Start / win / lose text (280 chars)
- Star 2 / star 3 rules
- Per-colour controller + AI style
- Drag order in the library (playlists follow this)
- Default level (boot into this map)

**Levels** library: filter by category and era, thumbs, teasers, open / play.

Toolbar **Play game** returns to the home screen.

In-match: level dropdown (includes Random map), New map / rematch, log, unit overview (HP + value).

---

## Persistence

- Browser: units, levels, formations, AI checklist, period, wins + best stars.
- Optional PHP store (`public/api.php` → `public/data.json`): units, levels, formations, default IDs, AI checklist. Version dot is green when the store is up.
- Wins / best stars stay local (not synced).

---

## What this file is not

Rules details live in `src/engine.ts`. How to run the app is in `README.md`. Stock stats can diverge the moment someone edits **Units**.
