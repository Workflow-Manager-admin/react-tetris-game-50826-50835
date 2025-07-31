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
    fallTimer.current = setTimeout(() => fall(), speed);
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
        setTimeout(() => fall(), 20);
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
    // Sleek, rounded, modern app-look for cells; no debug outlines, soft shadow on filled blocks
    const style: React.CSSProperties = {
      width: dimensions.cell - 3.5,
      height: dimensions.cell - 3.5,
      background:
        ghost
          ? COLORS.ghost
          : filled
            ? color
            : COLORS.cell,
      border: filled ? `1.3px solid #191f33cc` : "none",
      borderRadius: 8.5,
      margin: 1.2,
      boxSizing: "border-box",
      boxShadow: filled && !ghost ? "0 2.3px 13px #0013, 0 1.1px 7px #181c232e" : undefined,
      opacity: ghost ? 0.42 : 1,
      transition: "background 0.11s, border 0.12s",
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

  // --- UI Overhaul for professional mobile look ---

  // Touch-friendly controls for mobile
  const mobileControlBtn = (label: string, onClick: () => void, aria: string, icon?: React.ReactNode) => (
    <button
      style={{
        width: 62,
        height: 62,
        fontSize: 32,
        fontWeight: 800,
        borderRadius: "55%",
        background: "linear-gradient(180deg,#232944 78%, #1a2443 100%)",
        border: `2.4px solid ${COLORS.primary}`,
        color: COLORS.accent,
        boxShadow: "0 3px 7px #141a2e55",
        margin: 6,
        outline: "none",
        cursor: "pointer",
        userSelect: "none",
        transition: "background 0.1s, border 0.14s, color 0.07s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "manipulation",
      }}
      aria-label={aria}
      tabIndex={0}
      onClick={onClick}
    >
      {icon || label}
    </button>
  );

  // mobile control handlers
  const moveLeft = () => {
    if (piece && !isPaused && !isGameOver) {
      let pos = { ...piece.pos, x: piece.pos.x - 1 };
      if (isValidPosition(board, piece.shape, pos)) setPiece({ ...piece, pos });
    }
  };
  const moveRight = () => {
    if (piece && !isPaused && !isGameOver) {
      let pos = { ...piece.pos, x: piece.pos.x + 1 };
      if (isValidPosition(board, piece.shape, pos)) setPiece({ ...piece, pos });
    }
  };
  const moveDown = () => {
    if (piece && !isPaused && !isGameOver) {
      let pos = { ...piece.pos, y: piece.pos.y + 1 };
      if (isValidPosition(board, piece.shape, pos)) setPiece({ ...piece, pos });
    }
  };
  const rotatePiece = () => {
    if (piece && !isPaused && !isGameOver) {
      let nextShape = rotate(piece.shape);
      if (isValidPosition(board, nextShape, piece.pos))
        setPiece({ ...piece, shape: nextShape });
    }
  };
  const hardDrop = () => {
    if (piece && !isPaused && !isGameOver) {
      let dropTo = getDropY(board, piece.shape, piece.pos);
      setPiece({ ...piece, pos: { ...piece.pos, y: dropTo } });
      setTimeout(() => fall(), 26);
    }
  };

  // Overhauled Layout
  return (
    <div
      className="tetris-game-layout"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        width: "100vw",
        background: COLORS.background,
        fontFamily: FONT_FAMILY,
        padding: 0,
      }}
    >
      {/* Score Panel */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "linear-gradient(172deg,#232944 95%,#1a2443 100%)",
          borderRadius: 18,
          padding: "16px 32px 18px 32px",
          boxShadow: "0 6px 32px -4px #1a1c338c",
          border: `2.1px solid ${COLORS.primary}`,
          marginBottom: 18,
          marginTop: 28,
          minWidth: 220,
          maxWidth: 380,
        }}
      >
        <span
          style={{
            color: COLORS.accent,
            fontWeight: 800,
            fontSize: 40,
            letterSpacing: 1.2,
            lineHeight: 1.09,
            textShadow: `0 3px 13px #0812`,
            marginBottom: 8,
          }}
        >
          TETRIS
        </span>
        <span style={{
          fontSize: 22,
          color: COLORS.text,
          letterSpacing: 0.7,
          opacity: 0.87,
          fontWeight: 600,
        }}>Score</span>
        <span style={{
          fontSize: 38,
          color: COLORS.accent,
          fontWeight: 900,
          letterSpacing: "1.1px",
          marginBottom: 8,
        }}>{score}</span>
        <div style={{
          display: "flex",
          gap: '24px',
          width: "90%",
          marginTop: 7,
          alignItems: "center",
          justifyContent: "center"
        }}>
          <div>
            <div style={{ fontSize: 13.5, color: "#7fa1", opacity: 0.7 }}>Level</div>
            <div style={{
              fontSize: 21, color: COLORS.primary, fontWeight: 700,
              background: "#253466da", borderRadius: 6, padding: "1.5px 7px", marginTop: 1
            }}>{level + 1}</div>
          </div>
          <div>
            <div style={{ fontSize: 13.5, color: "#7fa1", opacity: 0.7 }}>Lines</div>
            <div style={{
              fontSize: 21,
              color: COLORS.accent,
              background: "#402b1b70",
              fontWeight: 600,
              borderRadius: 6,
              padding: "1.5px 7px",
              marginTop: 1,
            }}>{lines}</div>
          </div>
        </div>
      </div>

      {/* Game/next/controls */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        width: "100%",
      }}>
        {/* Board + next piece row */}
        <div style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "center",
          width: "100%",
          gap: "28px"
        }}>
          {/* Board */}
          <div
            className="tetris-board-container"
            tabIndex={0}
            ref={gameBoardRef}
            style={{
              background: "#12151b",
              border: `4px solid ${COLORS.primary}`,
              borderRadius: 21,
              boxShadow: "0px 6px 28px -10px #173353b0",
              padding: 12,
              width: dimensions.boardW,
              height: dimensions.boardH,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "center",
              marginBottom: 6,
              position: "relative",
              transition: "border 0.13s",
              outline: "3px solid #181c2965",
            }}
          >
            {/* Game Over Overlay */}
            {isGameOver && (
              <div
                style={{
                  position: "absolute",
                  zIndex: 11,
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                  background: `rgba(27,31,43,0.87)`,
                  borderRadius: 21,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 46,
                  color: flashGameOver ? COLORS.accent : COLORS.primary,
                  fontWeight: 900,
                  letterSpacing: 2,
                  filter: flashGameOver ? "drop-shadow(0px 0px 10px #ff0a)" : "",
                  animation: "fade-in 0.5s",
                  boxShadow: "0 4px 18px #160f189b"
                }}
              >
                <span
                  style={{
                    fontSize: 64,
                    marginBottom: 12,
                    fontWeight: 900,
                    textShadow: `0 4px 20px #000b`,
                  }}
                >
                  GAME OVER
                </span>
                <span style={{ fontSize: 27, marginBottom: 2 }}>
                  Score: <span style={{ color: COLORS.accent }}>{score}</span>
                </span>
                <button
                  style={{
                    marginTop: 25,
                    fontSize: 22,
                    borderRadius: 12,
                    border: "none",
                    padding: "8px 17px",
                    fontWeight: 700,
                    background: COLORS.primary,
                    color: "#fff",
                    cursor: "pointer",
                    transition: "background 0.13s",
                    boxShadow: "0 2px 14px #132",
                    letterSpacing: 0.4,
                  }}
                  onClick={initGame}
                  tabIndex={0}
                >
                  Restart
                </button>
              </div>
            )}
            {/* Pause Overlay */}
            {!isGameOver && isPaused && (
              <div
                style={{
                  position: "absolute",
                  zIndex: 11,
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                  background: "#1b204baa",
                  borderRadius: 21,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 44,
                  color: COLORS.secondary,
                  fontWeight: 900,
                  letterSpacing: 2,
                  animation: "fade-in 0.5s",
                }}
              >
                <span
                  style={{
                    marginBottom: 18,
                    textShadow: `0 2px 16px #000a`,
                  }}
                >
                  PAUSED
                </span>
                <span style={{
                  fontSize: 18, fontWeight: 500, opacity: 0.91, marginTop: 7
                }}>
                  Tap board, or <span style={{ color: COLORS.accent }}>Space</span> to resume
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
                boxShadow: "0px 0.5px 8px #01040a60",
              }}
            >
              {renderBoard()}
            </div>
          </div>
          {/* Next Piece */}
          <div style={{
            background: "#222a36",
            borderRadius: 13,
            padding: "12px 11px",
            boxShadow: "0 4px 16px #110f2245",
            border: `2px solid ${COLORS.secondary}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minWidth: "86px",
            marginLeft: 2,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 15, letterSpacing: 0.5, color: COLORS.accent, marginBottom: 3 }}>
              NEXT
            </div>
            <NextPiecePreview
              pieceType={nextPieceType}
              cellSize={Math.max(dimensions.cell * 0.76, 16)}
            />
          </div>
        </div>
        {/* Touch/Mobile Controls */}
        <div
          style={{
            marginTop: 25,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "98vw",
          }}
        >
          <div style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
            marginBottom: 4,
          }}>
            {mobileControlBtn("⭠", moveLeft, "Move Left")}
            {mobileControlBtn("⭡", rotatePiece, "Rotate")}
            {mobileControlBtn("⭢", moveRight, "Move Right")}
            {mobileControlBtn("⭣", moveDown, "Soft Drop")}
            {mobileControlBtn("↓", hardDrop, "Hard Drop", <span style={{ fontSize: 26 }}>DROP</span>)}
          </div>
        </div>
      </div>

      {/* Footer/Credits */}
      <div
        style={{
          marginTop: 32,
          marginBottom: 14,
          fontSize: 13,
          color: "#fff6",
          opacity: 0.66,
          textAlign: "center"
        }}
      >
        <span role="img" aria-label="joy">🎮</span> Tetris Demo &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
};

/* kbdStyle: removed, no longer needed for mobile controls */

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
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        padding: 4,
      }}
    >
      {preview.map((row, y) => (
        <div style={{ display: "flex" }} key={y}>
          {row.map((cell, x) => (
            <div
              key={x}
              style={{
                width: cellSize - 7.5,
                height: cellSize - 7.5,
                margin: 1.1,
                borderRadius: 6,
                background: cell ? cell : "#23293d",
                boxShadow: cell ? `0px 1.3px 8px #0006` : "none",
                border: cell ? `1.2px solid #0c102055` : "none",
                transition: "background 0.13s, border 0.15s",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * No longer used, keyboard instruction panel removed for mobile/app look.
 */
