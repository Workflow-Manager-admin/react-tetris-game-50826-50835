//
// Types for the Tetris game.
//

// PUBLIC_INTERFACE
export type Cell = {
  filled: boolean;
  color: string;
};

export type Board = Cell[][];

export type Tetromino = {
  shape: number[][];
  color: string;
};

export type Position = {
  x: number;
  y: number;
};

// Only classic 7 tetrominos.
export type TetrominoType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

// PUBLIC_INTERFACE
export type GameStatus = "running" | "paused" | "gameover";

