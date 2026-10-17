export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
export type PieceType = (typeof PIECE_TYPES)[number];

/** Rotation state: 0 = spawn, 1 = right (CW), 2 = 180°, 3 = left (CCW). */
export type Rotation = 0 | 1 | 2 | 3;

export interface Cell {
  x: number;
  y: number;
}

/** Spawn shapes inside their SRS bounding box. `y` grows downwards. */
const SPAWN_SHAPES: Record<PieceType, string[]> = {
  I: ['....', 'XXXX', '....', '....'],
  O: ['XX', 'XX'],
  T: ['.X.', 'XXX', '...'],
  S: ['.XX', 'XX.', '...'],
  Z: ['XX.', '.XX', '...'],
  J: ['X..', 'XXX', '...'],
  L: ['..X', 'XXX', '...'],
};

function parseShape(rows: string[]): Cell[] {
  return rows.flatMap((row, y) => [...row].flatMap((char, x) => (char === 'X' ? [{ x, y }] : [])));
}

/** Rotates cells clockwise inside a square box of the given size. */
function rotateClockwise(cells: Cell[], size: number): Cell[] {
  return cells.map(({ x, y }) => ({ x: size - 1 - y, y: x }));
}

function buildRotations(type: PieceType): Cell[][] {
  const size = SPAWN_SHAPES[type].length;
  const states = [parseShape(SPAWN_SHAPES[type])];
  for (let i = 1; i < 4; i++) {
    states.push(rotateClockwise(states[i - 1]!, size));
  }
  return states;
}

const ROTATIONS: Record<PieceType, Cell[][]> = Object.fromEntries(
  PIECE_TYPES.map((type) => [type, buildRotations(type)]),
) as Record<PieceType, Cell[][]>;

export function boxSize(type: PieceType): number {
  return SPAWN_SHAPES[type].length;
}

export function shapeCells(type: PieceType, rotation: Rotation): Cell[] {
  return ROTATIONS[type][rotation]!;
}

/**
 * SRS wall kick offsets, written with `y` pointing up as in the guideline.
 * Key: `${from}${to}`.
 */
// prettier-ignore
const KICKS_JLSTZ: Record<string, [number, number][]> = {
  '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

// prettier-ignore
const KICKS_I: Record<string, [number, number][]> = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

/** Kick offsets converted to board coordinates (`y` grows downwards). */
export function kickOffsets(type: PieceType, from: Rotation, to: Rotation): Cell[] {
  if (type === 'O') return [{ x: 0, y: 0 }];
  const table = type === 'I' ? KICKS_I : KICKS_JLSTZ;
  return table[`${from}${to}`]!.map(([x, y]) => ({ x, y: -y }));
}
