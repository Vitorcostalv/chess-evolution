"use client";
import { useEffect, useMemo, useState } from "react";
import { pieceInstances } from "@/services/games/pieces";
import {
  transitionPieces,
  type VisualPiece,
} from "@/services/games/presentation";
export function useBoardMotion(
  initialFen: string,
  pgn: string,
  session: string,
  duration: number,
  complete?: () => void,
) {
  const target = useMemo(
    () => pieceInstances(initialFen, pgn),
    [initialFen, pgn],
  );
  const [frame, setFrame] = useState<{
    session: string;
    pieces: VisualPiece[];
    started: number;
  }>({ session, pieces: target, started: 0 });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      setFrame((previous) => ({
        session,
        started: performance.now(),
        pieces:
          duration && previous.session === session
            ? transitionPieces(
                previous.pieces.filter((p) => !p.exiting),
                target,
              )
            : target,
      }));
      timer = setTimeout(() => {
        setFrame({ session, started: 0, pieces: target });
        complete?.();
      }, duration);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [target, session, duration, complete]);
  return {
    pieces: frame.session === session ? frame.pieces : target,
    started: frame.started,
    duration,
  };
}
