import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  createEmptyBoard,
  createBagRNG,
  getTetromino,
  isValidPosition,
  mergeBoard,
  rotate,
  clearRows,
  randomSeededRNG,
} from "../tetris/engine";
import {
  Board,
  Position,
  Tetromino,
  TetrominoType,
  GameStatus,
} from "../tetris/types";

// [ ... The main TetrisGame code up to useTetrisControls ... (see previous content) ... ]

// Hook: Keyboard controls
function useTetrisControls(
  gameStatus: GameStatus,
  onLeft: (d: -1 | 1) => void,
  onDown: () => void,
  onRotate: () => void,
  onDrop: () => void,
  onRestart: () => void,
  dropKeyChecker: (e: { code: string }) => boolean
) {
  useEffect(() => {
    if (gameStatus !== "running" && gameStatus !== "gameover") return;
    // Keyboard event should be available globally in browser (for React)
    function handleKeyDown(e: any) {
      if (gameStatus === "gameover") {
        // R to restart
        if (e.code === "KeyR") {
          e.preventDefault();
          onRestart();
        }
        return;
      }
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
          e.preventDefault();
          onLeft(-1);
          break;
        case "ArrowRight":
        case "KeyD":
          e.preventDefault();
          onLeft(1);
          break;
        case "ArrowDown":
        case "KeyS":
          e.preventDefault();
          onDown();
          break;
        case "ArrowUp":
        case "KeyW":
          e.preventDefault();
          onRotate();
          break;
        case "Space":
          if (!e.repeat) {
            e.preventDefault();
            onDrop();
          }
          break;
        case "KeyR":
          e.preventDefault();
          onRestart();
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () =>
      window.removeEventListener("keydown", handleKeyDown);
  }, [gameStatus, onLeft, onDown, onRotate, onDrop, onRestart]);
}

// Custom hook: setInterval for functional components
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// End of file

