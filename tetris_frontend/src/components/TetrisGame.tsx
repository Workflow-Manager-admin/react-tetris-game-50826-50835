/* global setTimeout, clearTimeout */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Board,
  GameStatus,
  TetrominoType,
  Position,
} from "../tetris/types";
import {
  createEmptyBoard,
  getTetromino,
  createBagRNG,
  rotate,
  isValidPosition,
  mergeBoard,
  clearRows,
  randomSeededRNG,
} from "../tetris/engine";

// Tetris settings
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const COLORS = {
  background: "#182027",
  cell: "#222933",
  border: "#444b52",
  primary: "#2196F3",
  secondary: "#1E88E5",
  accent: "#FFEB3B",
  text: "#fff",
  ghost: "#4c6070aa"
};
const FONT_FAMILY = '"SF Pro Text", "Segoe UI", Helvetica, Arial, sans-serif';

// How fast pieces fall (milliseconds) per level
const LEVEL_SPEEDS = [
  800, 700, 600, 500, 400, 350, 300, 260, 220, 180,
  150, 120, 100, 90, 80, 70, 60, 55, 50, 40,
];

const START_LEVEL = 0;

  // Remove unused type
// type Move = "left" | "right" | "down" | "rotate" | "drop" | "pause" | "restart";

interface PieceState {
  type: TetrominoType;
  shape: number[][];
  pos: Position;
  color: string;
}

function getDropY(board: Board, shape: number[][], pos: Position): number {
  let dropY = pos.y;
  while (isValidPosition(board, shape, { x: pos.x, y: dropY + 1 })) {
    dropY++;
  }
  return dropY;
}

function getLevelByLines(linesCleared: number): number {
  return Math.min(Math.floor(linesCleared / 10), LEVEL_SPEEDS.length - 1);
}

function getScoreForClearedRows(rows: number, level: number): number {
  // Classic NES scoring
  const points = [0, 40, 100, 300, 1200];
  return (points[rows] ?? 0) * (level + 1);
}

/**
 * PUBLIC_INTERFACE
 * TetrisGame UI - connects all gameplay, handles controls, scoring, and visuals.
 */
export const TetrisGame: React.FC = () => {
  // State
  const [board, setBoard] = useState<Board>(() =>
    createEmptyBoard(BOARD_HEIGHT, BOARD_WIDTH)
  );
  const [piece, setPiece] = useState<PieceState | null>(null);
  const [nextPieceType, setNextPieceType] = useState<TetrominoType | null>(
    null
  );
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(START_LEVEL);
  const [status, setStatus] = useState<GameStatus>("running");
  const [flashGameOver, setFlashGameOver] = useState(false);

  // Bag RNG - stable per session
  const rngRef = useRef<() => number>();
  const bagRef = useRef<() => TetrominoType>();

  // Track input (for holding pause state, etc)
  const isPaused = status === "paused";
  const isGameOver = status === "gameover";

  // Timing (falling)
  const fallTimer = useRef<any>(null);

  // Start function
  const initGame = useCallback(() => {
    if (!rngRef.current) {
      rngRef.current = randomSeededRNG(Date.now() % 654321);
    }
    bagRef.current = createBagRNG(rngRef.current!);

    const first = bagRef.current!();
    const second = bagRef.current!();

    setBoard(createEmptyBoard(BOARD_HEIGHT, BOARD_WIDTH));
    setLines(0);
    setScore(0);
    setLevel(START_LEVEL);
    setStatus("running");
    setNextPieceType(second);

    const { shape, color } = getTetromino(first);
    setPiece({
      type: first,
      shape: shape.map(row => [...row]),
      pos: { x: Math.floor((BOARD_WIDTH - shape[0].length) / 2), y: 0 },
      color,
    });
  }, []);

  // Pass to effect for restart
  useEffect(() => {
    initGame();
    // Do not add dependencies (initGame intentionally has stable rngRef)
  }, []);

  // Apply next piece
  const spawnPiece = useCallback(() => {
    if (!bagRef.current) return;
    const type = nextPieceType ?? bagRef.current();
    const nextType = bagRef.current();
    const { shape, color } = getTetromino(type);
    setPiece({
      type,
      shape: shape.map(row => [...row]),
      pos: { x: Math.floor((BOARD_WIDTH - shape[0].length) / 2), y: 0 },
      color,
    });
    setNextPieceType(nextType);
  }, [nextPieceType]);

  // Falling handler
  const fall = useCallback(() => {
    if (!piece || isPaused || isGameOver) return;
    const nextPos = { x: piece.pos.x, y: piece.pos.y + 1 };
    if (isValidPosition(board, piece.shape, nextPos)) {
      setPiece({ ...piece, pos: nextPos });
    } else {
      // Lock piece + clear rows
      const merged = mergeBoard(board, piece.shape, piece.pos, piece.color);
      const { board: cleared, cleared: rowsCleared } = clearRows(merged);
      setBoard(cleared);
      // Score and lines
      if (rowsCleared) {
        setScore(s => s + getScoreForClearedRows(rowsCleared, level));
        setLines(l => l + rowsCleared);
      }
      // New level?
      setLevel(getLevelByLines(lines + rowsCleared));
      // Spawn next
      setTimeout(() => {
        spawnPiece();
      }, 10);
      // Game over? Piece was at top and can't be placed...
      if (piece.pos.y === 0) {
        setStatus("gameover");
        setFlashGameOver(true);
        setTimeout(() => setFlashGameOver(false), 400);
      }
    }
  }, [
    piece,
    board,
    isPaused,
    isGameOver,
    lines,
    level,
    spawnPiece,
  ]);

  // Falling timer
  useEffect(() => {
    if (isPaused || isGameOver || !piece) {
      if (fallTimer.current) clearTimeout(fallTimer.current);
      return;
    }
    const speed = LEVEL_SPEEDS[level] ?? 40;
    fallTimer.current = setTimeout(fall, speed);
    return () => {
      if (fallTimer.current) clearTimeout(fallTimer.current);
    };
  }, [piece, isPaused, isGameOver, fall, level]);

  // Keyboard events
  useEffect(() => {
    if (isGameOver) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (isPaused) {
        if (e.key === " " || e.code === "Space") setStatus("running");
        return;
      }
      if (!piece) return;
      let handled = false;

      let nextShape = piece.shape.map(row => [...row]);
      let nextPos = { ...piece.pos };

      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          nextPos.x--;
          handled = true;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          nextPos.x++;
          handled = true;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          nextPos.y++;
          handled = true;
          break;
        case "ArrowUp":
        case "w":
        case "W":
        case "x":
        case "X":
          nextShape = rotate(piece.shape);
          handled = true;
          break;
        case " ":
        case "Spacebar":
          // Hard drop
          nextPos.y = getDropY(board, nextShape, piece.pos);
          handled = true;
          break;
        case "p":
        case "P":
          setStatus("paused");
          handled = true;
          break;
        case "r":
        case "R":
          initGame();
          handled = true;
          return;
        default:
          break;
      }
      if (handled) e.preventDefault();

      if (e.key === " " || e.code === "Space") {
        // Hard drop
        setPiece({ ...piece, pos: nextPos });
        setTimeout(fall, 20);
        return;
      }
      if (isValidPosition(board, nextShape, nextPos)) {
        setPiece({ ...piece, shape: nextShape, pos: nextPos });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [piece, board, isPaused, isGameOver, fall, initGame]);

  // Handle restart after game over
  useEffect(() => {
    if (!isGameOver) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "r" || e.key === "R" || e.code === "Space" || e.key === " ") {
        e.preventDefault();
        initGame();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isGameOver, initGame]);

  // Responsive sizing
  const gameBoardRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ cell: 32, boardW: 320, boardH: 640 });

  useEffect(() => {
    const handleResize = () => {
      let maxW = Math.min(window.innerWidth - 48, 440);
      let maxH = Math.min(window.innerHeight - 128, 700);
      let cell = Math.floor(Math.min(maxW / BOARD_WIDTH, maxH / BOARD_HEIGHT));
      cell = Math.max(cell, 18);
      setDimensions({
        cell,
        boardW: cell * BOARD_WIDTH,
        boardH: cell * BOARD_HEIGHT,
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Board rendering helpers
  const drawCell = (
    { filled, color }: { filled: boolean; color: string },
    x: number,
    y: number,
    cell: number,
    ghost = false
  ) => {
    const style: React.CSSProperties = {
      width: dimensions.cell - 2,
      height: dimensions.cell - 2,
      background:
        ghost
          ? COLORS.ghost
          : filled
            ? color
            : COLORS.cell,
      border: filled ? `1.5px solid ${COLORS.border}` : `1px solid ${COLORS.border}`,
      borderRadius: 6,
      margin: 0.5,
      boxSizing: "border-box",
      opacity: ghost ? 0.4 : 1,
      transition: "background 0.09s",
    };
    return (
      <div
        className="tetris-cell"
        key={`cell-${x}-${y}-${cell}${ghost ? "-g" : ""}`}
        style={style}
      />
    );
  };

  const renderBoard = (): React.ReactNode[] => {
    // Merge active piece
    const drawn: { filled: boolean; color: string }[][] = board.map(row =>
      row.map(cell => ({ ...cell }))
    );
    // Ghost
    let ghostY: number | null = null;
    if (piece) {
      ghostY = getDropY(board, piece.shape, piece.pos);
      // Draw ghost
      piece.shape.forEach((row, dy) => {
        row.forEach((cell, dx) => {
          if (!cell) return;
          const x = piece.pos.x + dx;
          const y = ghostY! + dy;
          if (
            x >= 0 &&
            x < BOARD_WIDTH &&
            y >= 0 &&
            y < BOARD_HEIGHT &&
            !drawn[y][x].filled
          ) {
            drawn[y][x] = { filled: true, color: COLORS.ghost };
          }
        });
      });

      // Draw piece
      piece.shape.forEach((row, dy) => {
        row.forEach((cell, dx) => {
          if (!cell) return;
          const x = piece.pos.x + dx;
          const y = piece.pos.y + dy;
          if (
            x >= 0 &&
            x < BOARD_WIDTH &&
            y >= 0 &&
            y < BOARD_HEIGHT
          ) {
            drawn[y][x] = { filled: true, color: piece.color };
          }
        });
      });
    }

    return drawn.map((row, y) => (
      <div
        style={{ display: "flex" }}
        key={`row-${y}`}
      >
        {row.map((cell, x) =>
          drawCell(cell, x, y, y * BOARD_WIDTH + x, cell.color === COLORS.ghost)
        )}
      </div>
    ));
  };

  // Score/next/controls panel
  return (
    <div
      className="tetris-game-layout"
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 32,
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: COLORS.background,
        fontFamily: FONT_FAMILY,
        color: COLORS.text,
        padding: 12,
        boxSizing: "border-box",
        width: "100vw",
      }}
    >
      {/* Board */}
      <div
        className="tetris-board-container"
        style={{
          background: "#12151b",
          border: `3px solid ${COLORS.primary}`,
          borderRadius: 17,
          boxShadow: "0px 7px 40px -13px #183165dd",
          padding: 9,
          width: dimensions.boardW,
          height: dimensions.boardH,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: 8,
          position: "relative",
          transition: "border 0.12s",
        }}
        tabIndex={0}
        ref={gameBoardRef}
      >
        {/* Game Over Overlay */}
        {isGameOver && (
          <div
            style={{
              position: "absolute",
              zIndex: 10,
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              background: `${COLORS.background}cc`,
              borderRadius: 17,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              color: flashGameOver ? COLORS.accent : COLORS.primary,
              fontWeight: 800,
              letterSpacing: 2,
              filter: flashGameOver ? "drop-shadow(0px 0px 10px #ff0a)" : "",
              animation: "fade-in 0.5s",
            }}
          >
            <span
              style={{
                fontSize: 56,
                marginBottom: 10,
                fontWeight: 900,
                textShadow: `0 2px 16px #000`,
              }}
            >
              GAME OVER
            </span>
            <span style={{ fontSize: 26 }}>
              Score: <span style={{ color: COLORS.accent }}>{score}</span>
            </span>
            <span style={{ fontSize: 19, opacity: 0.85, marginTop: 12 }}>
              Press <kbd style={kbdStyle}>R</kbd> or <kbd style={kbdStyle}>Space</kbd> to restart
            </span>
          </div>
        )}
        {/* Pause Overlay */}
        {!isGameOver && isPaused && (
          <div
            style={{
              position: "absolute",
              zIndex: 10,
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              background: "#232944cc",
              borderRadius: 17,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              color: COLORS.secondary,
              fontWeight: 800,
              letterSpacing: 2,
            }}
          >
            <span
              style={{
                marginBottom: 18,
                textShadow: `0 2px 16px #000`,
              }}
            >
              PAUSED
            </span>
            <span style={{ fontSize: 18, fontWeight: 400, opacity: 0.85 }}>
              Press <kbd style={kbdStyle}>Space</kbd> to resume
            </span>
          </div>
        )}
        <div
          style={{
            width: dimensions.boardW,
            height: dimensions.boardH,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            zIndex: 1,
            pointerEvents: "none",
            filter: isGameOver ? "blur(2.1px)" : undefined,
          }}
        >
          {renderBoard()}
        </div>
      </div>
      {/* Side Panel */}
      <div
        className="tetris-sidepanel"
        style={{
          minWidth: 160,
          display: "flex",
          flexDirection: "column",
          gap: 22,
          alignItems: "flex-start",
          justifyContent: "flex-start",
        }}
      >
        <div
          style={{
            background: COLORS.cell,
            borderRadius: 10,
            padding: "10px 18px 13px 18px",
            boxShadow: "0 2px 11px #222a",
            border: `1.7px solid ${COLORS.border}`,
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 15, letterSpacing: 1, opacity: 0.92 }}>
            Score
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.accent }}>
            {score}
          </div>
          <div style={{ fontSize: 12, color: "#eee", marginTop: 2 }}>
            Level:{" "}
            <strong style={{ color: COLORS.primary }}>{level + 1}</strong>
          </div>
          <div style={{ fontSize: 12, color: "#eee", marginTop: 2 }}>
            Lines: <strong>{lines}</strong>
          </div>
        </div>
        {/* Next Piece */}
        <div
          style={{
            background: COLORS.cell,
            borderRadius: 10,
            padding: "10px 14px",
            boxShadow: "0 2px 10px #111a",
            border: `1.5px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontSize: 14, marginBottom: 4, color: "#fffc" }}>
            Next
          </div>
          <NextPiecePreview
            pieceType={nextPieceType}
            cellSize={dimensions.cell}
          />
        </div>
        {/* Controls */}
        <div
          style={{
            marginTop: 24,
            borderTop: `1.5px solid #4447`,
            paddingTop: 10,
          }}
        >
          <div
            style={{
              fontSize: 13,
              opacity: 0.75,
              marginBottom: 3,
              letterSpacing: 0.5,
            }}
          >
            Controls
          </div>
          <ControlsList />
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ marginTop: 22, opacity: 0.36, fontSize: 12 }}>
          <span role="img" aria-label="joy">
            🎮
          </span>{" "}
          Tetris Demo &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
};

const kbdStyle: React.CSSProperties = {
  padding: "2px 7px",
  borderRadius: 4,
  border: "1px solid #556",
  background: "#2a2d3d",
  color: "#ffe",
  fontSize: 13,
  fontFamily: "monospace",
  margin: "0 1.6px",
  boxShadow: "0 1px 2px #1116",
  display: "inline-block",
};

// Next piece preview
const NextPiecePreview: React.FC<{ pieceType: TetrominoType | null; cellSize: number }> = ({
  pieceType,
  cellSize,
}) => {
  if (!pieceType) return <div style={{ height: cellSize * 4, width: cellSize * 4 }} />;
  const { shape, color } = getTetromino(pieceType);
  // Center in 4x4 viewport
  const padRows = 4 - shape.length;
  const padCols = 4 - shape[0].length;

  const preview = Array.from({ length: 4 }).map((_, y) =>
    Array.from({ length: 4 }).map((_, x) =>
      (y >= Math.floor(padRows / 2) &&
        y < Math.floor(padRows / 2) + shape.length &&
        x >= Math.floor(padCols / 2) &&
        x < Math.floor(padCols / 2) + shape[0].length &&
        shape[y - Math.floor(padRows / 2)][x - Math.floor(padCols / 2)]
      )
        ? color
        : null
    )
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: cellSize * 4,
        width: cellSize * 4,
        background: "#181c23",
        borderRadius: 7,
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
      }}
    >
      {preview.map((row, y) => (
        <div style={{ display: "flex" }} key={y}>
          {row.map((cell, x) => (
            <div
              key={x}
              style={{
                width: cellSize - 5,
                height: cellSize - 5,
                margin: 0.7,
                borderRadius: 4,
                background: cell ? cell : "#23293d",
                boxShadow: cell ? `0px 1px 6px #0005` : "none",
                border: cell ? `1.3px solid #272e59c8` : "1px solid #142144",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

// Controls panel
const ControlsList: React.FC = () => (
  <div style={{ fontFamily: FONT_FAMILY, color: "#eee", fontSize: 13 }}>
    <div>
      <kbd style={kbdStyle}>←</kbd> / <kbd style={kbdStyle}>A</kbd> = Move Left
    </div>
    <div>
      <kbd style={kbdStyle}>→</kbd> / <kbd style={kbdStyle}>D</kbd> = Move Right
    </div>
    <div>
      <kbd style={kbdStyle}>↓</kbd> / <kbd style={kbdStyle}>S</kbd> = Move Down
    </div>
    <div>
      <kbd style={kbdStyle}>↑</kbd> / <kbd style={kbdStyle}>W</kbd> / <kbd style={kbdStyle}>X</kbd> = Rotate
    </div>
    <div>
      <kbd style={kbdStyle}>Space</kbd> = Hard Drop
    </div>
    <div>
      <kbd style={kbdStyle}>P</kbd> = Pause/Resume
    </div>
    <div>
      <kbd style={kbdStyle}>R</kbd> = Restart
    </div>
  </div>
);
