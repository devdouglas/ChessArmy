import { defaultFacing } from '../src/hex';
import {
  placeSlots,
  slotsFromSide,
  type ArmyEdge,
  type ArmySlot,
} from '../src/map';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const cols = 8;
const rows = 8;
const slots: ArmySlot[] = [
  { type: 'soldier', col: 0, fromBack: 0 },
  { type: 'tank', col: 2, fromBack: 1 },
];

const expect: Record<ArmyEdge, { col: number; row: number }[]> = {
  bottom: [
    { col: 0, row: 7 },
    { col: 2, row: 6 },
  ],
  top: [
    { col: 7, row: 0 },
    { col: 5, row: 1 },
  ],
  left: [
    { col: 0, row: 0 },
    { col: 1, row: 2 },
  ],
  right: [
    { col: 7, row: 7 },
    { col: 6, row: 5 },
  ],
};

const inward = {
  bottom: 2,
  top: 5,
  left: 0,
  right: 3,
} as const;

for (const edge of Object.keys(expect) as ArmyEdge[]) {
  const side = edge === 'bottom' ? 'red' : edge === 'top' ? 'blue' : edge === 'left' ? 'yellow' : 'purple';
  const placed = placeSlots(slots, side, cols, rows, cols, edge);
  assert(placed.length === 2, `${edge}: expected 2 stamps, got ${placed.length}`);
  for (let i = 0; i < 2; i++) {
    const p = placed[i]!;
    const e = expect[edge][i]!;
    assert(p.col === e.col && p.row === e.row, `${edge} ${i}: ${p.col},${p.row} != ${e.col},${e.row}`);
  }
  const face = placed[0]!.facing ?? defaultFacing(side);
  assert(face === inward[edge], `${edge}: facing ${face} != ${inward[edge]}`);
  const back = slotsFromSide(placed, side, cols, rows, edge);
  assert(back.length === 2, `${edge}: roundtrip count`);
  assert(back[0]!.col === 0 && back[0]!.fromBack === 0, `${edge}: roundtrip first`);
  assert(back[1]!.col === 2 && back[1]!.fromBack === 1, `${edge}: roundtrip second`);
}

{
  const red = placeSlots(slots, 'red', cols, rows, cols, 'left');
  const yellow = placeSlots(slots, 'yellow', cols, rows, cols, 'left');
  assert(red[0]!.col === yellow[0]!.col && red[0]!.row === yellow[0]!.row, 'same hexes on same edge');
  assert((red[0]!.facing ?? defaultFacing('red')) === 0, 'red on left faces east');
}

console.log('army edges: bottom/top/left/right stamp + roundtrip');
