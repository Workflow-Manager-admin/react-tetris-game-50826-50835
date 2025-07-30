import { Composition } from "remotion";
import TetrisApp from "./tetris/TetrisApp";

/**
 * PUBLIC_INTERFACE
 * RemotionRoot - registers the TetrisApp main game for Remotion compositions.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TetrisGame"
        component={TetrisApp}
        durationInFrames={6000}
        fps={60}
        width={600}
        height={800}
        defaultProps={{}}
      />
    </>
  );
};
