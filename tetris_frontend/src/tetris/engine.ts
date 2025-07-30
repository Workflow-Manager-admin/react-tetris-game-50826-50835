import { Board, Tetromino, Position, TetrominoType } from "./types";

// Tetromino definitions
const TETROMINOS: Record<TetrominoType, Tetromino> = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: "#2196F3",
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "#FFEB3B",
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#9C27B0",
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: "#43A047",
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: "#E53935",
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#1565C0",
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#FFA726",
  },
};

const TETROMINO_SEQUENCE: TetrominoType[] = ["I", "O", "T", "S", "Z", "J", "L"];

export function getTetromino(type: TetrominoType): Tetromino {
  return TETROMINOS[type];
}

/**
 * PUBLIC_INTERFACE
 * Returns a function that provides the next random TetrominoType using the "bag" system.
 * This avoids using the global window and instead manages the bag per consumer.
 */
export function createBagRNG(rng: () => number) {
  let bag: TetrominoType[] = [];
  function next() {
    if (bag.length === 0) {
      bag = shuffle([...TETROMINO_SEQUENCE], rng);
    }
    return bag.pop()!;
  }
  return next;
}

function shuffle(array: TetrominoType[], rng: () => number): TetrominoType[] {
  // Fisher-Yates shuffle
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function createEmptyBoard(rows = 20, cols = 10): Board {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      filled: false,
      color: "transparent",
    }))
  );
}

export function rotate(matrix: number[][]): number[][] {
  const N = matrix.length;
  const result: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  for (let y = 0; y < N; ++y) {
    for (let x = 0; x < N; ++x) {
      result[x][N - 1 - y] = matrix[y][x];
    }
  }
  return result;
}

export function isValidPosition(
  board: Board,
  shape: number[][],
  pos: Position
): boolean {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const bx = pos.x + x;
        const by = pos.y + y;
        // Out of bounds?
        if (bx < 0 || bx >= board[0].length || by < 0 || by >= board.length)
          return false;
        // Collides with board filled cell?
        if (board[by][bx].filled) return false;
      }
    }
  }
  return true;
}

export function mergeBoard(
  board: Board,
  shape: number[][],
  pos: Position,
  color: string
): Board {
  // Copy the board and apply shape at pos
  const newBoard: Board = board.map((row) =>
    row.map((cell) => ({ ...cell }))
  );
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const bx = pos.x + x;
        const by = pos.y + y;
        if (by >= 0 && by < newBoard.length && bx >= 0 && bx < newBoard[0].length) {
          newBoard[by][bx] = { filled: true, color };
        }
      }
    }
  }
  return newBoard;
}

export function clearRows(board: Board): { board: Board; cleared: number } {
  const rows = board.length;
  const cols = board[0].length;
  // Get rows that are full
  let cleared = 0;
  const newBoard: Board = [];
  for (let y = 0; y < rows; y++) {
    const isFull = board[y].every((cell) => cell.filled);
    if (!isFull) {
      newBoard.push(board[y]);
    } else {
      cleared++;
    }
  }
  while (newBoard.length < rows) {
    // Add empty row at the top
    newBoard.unshift(
      Array.from({ length: cols }, () => ({
        filled: false,
        color: "transparent",
      }))
    );
  }
  return { board: newBoard, cleared };
}

export function randomSeededRNG(seed: number) {
  // Mulberry32 PRNG, for deterministic gameplay/debug
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// For "bag" randomizer state.
declare global {
  // @ts-ignore
  interface Window {
    __tetrisBag?: TetrominoType[];
  }
}

