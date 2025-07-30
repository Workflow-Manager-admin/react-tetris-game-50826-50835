import React from "react";
import { TetrisGame } from "../components/TetrisGame";

import "../styles/tetris.css";

/**
 * PUBLIC_INTERFACE
 * Main entry point for the Tetris Game.
 * Modern, minimalistic, dark theme.
 */
/**
 * PUBLIC_INTERFACE
 * Main entry point for the Tetris Game.
 * Modern, minimalistic, dark theme.
 */
const TetrisApp: React.FC = () => {
  return (
    <div className="tetris-root">
      <TetrisGame />
    </div>
  );
};

export default TetrisApp;
