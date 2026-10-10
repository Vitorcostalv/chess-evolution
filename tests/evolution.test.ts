import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { useGame } from "@/stores/game";
import { usePreferences, migratePreferences } from "@/stores/preferences";
import { storage } from "@/services/storage/database";
import { DEFAULT_PREFERENCES } from "@/types/domain";
import { DEFAULT_POSITION } from "@/engine/chess/rules";
import { THEMES } from "@/services/games/appearance";
import { elapsedClock, timeoutResult } from "@/services/games/clocks";
import { pieceInstances } from "@/services/games/pieces";
import {
  transitionPieces,
  replayPosition,
} from "@/services/games/presentation";
import { EXERCISES } from "@/services/games/exercises";
import { reviewPoint } from "@/services/games/review";
import { createCandidate } from "@/services/models/candidate";
import {
  createNetwork,
  exportCheckpoint,
  initializeBackend,
} from "@/ai/neural/network";
import type { ModelRecord } from "@/types/domain";
describe("clock policy v2 and presentation state", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
    vi.spyOn(storage, "saveSession").mockResolvedValue();
    vi.spyOn(storage, "saveGame").mockResolvedValue();
    usePreferences.setState({
      value: { ...DEFAULT_PREFERENCES, sound: false },
    });
    useGame.getState().load(DEFAULT_POSITION);
    useGame.getState().configure({
      mode: "local",
      timeControl: 180,
      increment: 2,
      running: true,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it("adds an increment once, rejects duplicate moves, and restores clocks through undo/redo", () => {
    vi.setSystemTime(Date.now() + 1000);
    useGame.getState().move({ from: "e2", to: "e4" });
    expect(useGame.getState().seconds.w).toBe(181);
    useGame.getState().move({ from: "e2", to: "e4" });
    expect(useGame.getState().seconds.w).toBe(181);
    expect(useGame.getState().history).toHaveLength(1);
    useGame.getState().undo();
    expect(useGame.getState().seconds.w).toBe(179);
    useGame.getState().forward();
    expect(useGame.getState().seconds.w).toBe(181);
    expect(useGame.getState().running).toBe(false);
  });
  it("accounts for a delayed tick and rejects a move after flag fall", () => {
    useGame.getState().configure({ timeControl: 3, increment: 2 });
    vi.setSystemTime(Date.now() + 4000);
    useGame.getState().move({ from: "e2", to: "e4" });
    expect(useGame.getState().history).toHaveLength(0);
    expect(useGame.getState().result?.reason).toBe("Tempo esgotado");
    expect(useGame.getState().seconds.w).toBe(0);
    expect(useGame.getState().running).toBe(false);
    expect(elapsedClock(10, 1000, 4100)).toBeCloseTo(6.9);
  });
  it("unlimited games do not flag or accumulate increments", () => {
    useGame.getState().configure({ timeControl: 0, increment: 0 });
    vi.setSystemTime(Date.now() + 1000000);
    useGame.getState().tick();
    useGame.getState().move({ from: "e2", to: "e4" });
    expect(useGame.getState().result).toBeNull();
    expect(useGame.getState().seconds.w).toBe(0);
  });
  it("draws on timeout when the remaining opponent has only a king", () => {
    const c = new Chess("7k/8/6K1/8/8/8/8/Q7 w - - 0 1");
    expect(timeoutResult(c, "w").result).toBe("1/2-1/2");
  });
  it("blocks duplicate human input and ignores a previous game's animation completion", () => {
    useGame.getState().select("e2");
    useGame.getState().select("e4");
    const old = useGame.getState().visualToken;
    expect(useGame.getState().visualPending).toBe(true);
    useGame.getState().select("e7");
    expect(useGame.getState().selected).toBeNull();
    useGame.getState().reset();
    useGame.getState().move({ from: "d2", to: "d4" });
    useGame.getState().completeVisual(old);
    expect(useGame.getState().visualPending).toBe(true);
    useGame.getState().completeVisual(useGame.getState().visualToken);
    expect(useGame.getState().visualPending).toBe(false);
  });
  it("animated capture retains the victim at its own en passant square", () => {
    const c = new Chess();
    ["e4", "a6", "e5", "d5"].forEach((m) => c.move(m));
    const before = pieceInstances(DEFAULT_POSITION, c.pgn());
    c.move("exd6");
    const after = pieceInstances(DEFAULT_POSITION, c.pgn()),
      visual = transitionPieces(before, after);
    expect(visual.find((p) => p.exiting)?.square).toBe("d5");
    expect(visual.find((p) => p.square === "d6")?.fromSquare).toBe("e5");
  });
  it("castle presentation coordinates both original identities and promotion retains the pawn identity", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
      c = new Chess(fen),
      before = pieceInstances(fen, "");
    c.move("O-O");
    const move = transitionPieces(before, pieceInstances(fen, c.pgn()));
    expect(move.find((p) => p.square === "g1")?.fromSquare).toBe("e1");
    expect(move.find((p) => p.square === "f1")?.fromSquare).toBe("h1");
    const promotionFen = "7k/P7/8/8/8/8/8/7K w - - 0 1",
      p = new Chess(promotionFen);
    p.move("a8=N");
    expect(
      pieceInstances(promotionFen, p.pgn()).find((p) => p.square === "a8")?.id,
    ).toBe(pieceInstances(promotionFen, "").find((p) => p.square === "a7")?.id);
  });
  it("replay positions are pure and preserve the final PGN and result", () => {
    const c = new Chess();
    ["f3", "e5", "g4", "Qh4#"].forEach((m) => c.move(m));
    const pgn = c.pgn();
    expect(replayPosition(DEFAULT_POSITION, pgn, 0).fen).toBe(DEFAULT_POSITION);
    expect(replayPosition(DEFAULT_POSITION, pgn, 2).history).toEqual([
      "f3",
      "e5",
    ]);
    expect(replayPosition(DEFAULT_POSITION, pgn, 4).fen).toBe(c.fen());
    expect(c.pgn()).toBe(pgn);
    expect(c.isCheckmate()).toBe(true);
  });
  it("migrates old preferences and persists independent theme colors", async () => {
    expect(
      migratePreferences({ board: "2d", graphics: "low" }).appearance.preset,
    ).toBe("classic");
    await usePreferences.getState().update({
      appearance: { ...THEMES.mineral, selected: "#ab1234" },
      animation: "off",
    });
    await usePreferences.getState().load();
    expect(usePreferences.getState().value.appearance.selected).toBe("#ab1234");
    expect(usePreferences.getState().value.animation).toBe("off");
  });
  it("authored puzzle solutions are legal checkmates and review uses fixed white perspective", () => {
    for (const puzzle of EXERCISES) {
      const c = new Chess(puzzle.fen);
      if (puzzle.solution) {
        expect(c.isCheckmate()).toBe(false);
        c.move(puzzle.solution);
        expect(c.isCheckmate()).toBe(true);
      }
    }
    const c = new Chess();
    ["f3", "e5", "g4", "Qh4#"].forEach((m) => c.move(m));
    const point = reviewPoint(DEFAULT_POSITION, c.pgn(), 4);
    expect(point.score).toBeLessThan(0);
    expect(point.nodes).toBeGreaterThanOrEqual(0);
  });
  it("candidate creation isolates weights and preserves a champion record (declared status fixture)", async () => {
    await initializeBackend();
    const network = createNetwork("tiny");
    try {
      const checkpoint = await exportCheckpoint(network, {
        preset: "tiny",
        generation: 1,
        learningRate: 0.001,
        completedBatches: 1,
      });
      // Status fixture only tests immutability; it is not competitive evidence or UI data.
      const parent: ModelRecord = {
        id: crypto.randomUUID(),
        name: "Fixture",
        preset: "tiny",
        generation: 1,
        createdAt: new Date().toISOString(),
        origin: "test fixture",
        status: "champion",
        parameters: network.countParams(),
        completedBatches: 1,
        checkpoint,
        evaluations: [],
      };
      const original = structuredClone(parent),
        child = await createCandidate(parent, 0.002);
      expect(child.status).toBe("candidate");
      expect(child.generation).toBe(2);
      expect(child.parentId).toBe(parent.id);
      expect(child.id).not.toBe(parent.id);
      child.checkpoint.weights[0].values[0] += 1;
      expect(parent).toEqual(original);
    } finally {
      network.optimizer.dispose();
      network.dispose();
    }
  });
});
