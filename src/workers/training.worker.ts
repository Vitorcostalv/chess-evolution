/// <reference lib="webworker" />
import { Chess } from "chess.js";
import { storage } from "@/services/storage/database";
import {
  trainingConfigSchema,
  modelSchema,
} from "@/services/models/validation";
import {
  initializeBackend,
  createNetwork,
  exportCheckpoint,
  restoreCheckpoint,
  infer,
  trainBatch,
  validationLoss,
  tensorMemory,
} from "@/ai/neural/network";
import { playGeneratedGame, cooperate } from "@/ai/self-play/game";
import { seededRandom } from "@/engine/search/mcts";
import { evaluatePromotion } from "@/ai/evaluation/promotion";
import { createCandidate } from "@/services/models/candidate";
import type { ModelRecord, Experiment, Tournament } from "@/types/domain";
import type { LabRequest, LabResponse } from "./protocol";
declare const self: DedicatedWorkerGlobalScope;
let busy = false,
  paused = false,
  cancelled = false,
  started = 0;
const emit = (message: LabResponse) => self.postMessage(message);
async function gate() {
  if (Date.now() - started > 10 * 60 * 1000)
    throw new Error("Orçamento de 10 minutos atingido. Retome do checkpoint.");
  while (paused && !cancelled) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (cancelled)
    throw new Error("Sessão cancelada; último checkpoint preservado.");
  await cooperate();
}
function shuffle<T>(values: T[], seed: number) {
  const copy = [...values],
    random = seededRandom(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
self.onmessage = async (event: MessageEvent<LabRequest>) => {
  const request = event.data;
  if (request.type === "pause") {
    paused = true;
    emit({
      type: "progress",
      message: "Pausa solicitada; aguardando ponto consistente.",
    });
    return;
  }
  if (request.type === "resume") {
    paused = false;
    return;
  }
  if (request.type === "cancel") {
    cancelled = true;
    paused = false;
    return;
  }
  if (busy) {
    emit({
      type: "error",
      id: request.id,
      message: "Já existe uma tarefa neural em execução.",
    });
    return;
  }
  busy = true;
  paused = false;
  cancelled = false;
  started = Date.now();
  let experiment: Experiment | undefined;
  let tournament: Tournament | undefined;
  const tournamentNetworks: Awaited<ReturnType<typeof restoreCheckpoint>>[] =
    [];
  let network: Awaited<ReturnType<typeof restoreCheckpoint>> | undefined,
    opponent: typeof network;
  try {
    const backend = await initializeBackend();
    if (request.type === "create") {
      if (request.name.trim().length < 1 || request.name.length > 64)
        throw new Error("Nome de modelo inválido.");
      if (!["tiny", "standard", "research"].includes(request.preset))
        throw new Error("Preset inválido.");
      network = createNetwork(request.preset);
      const checkpoint = await exportCheckpoint(network, {
        preset: request.preset,
        generation: 0,
        learningRate: 0.001,
        completedBatches: 0,
      });
      const model: ModelRecord = {
        id: crypto.randomUUID(),
        name: request.name.trim(),
        preset: request.preset,
        generation: 0,
        createdAt: new Date().toISOString(),
        origin: "Inicialização Glorot (sem treino)",
        status: "candidate",
        parameters: network.countParams(),
        completedBatches: 0,
        checkpoint,
        evaluations: [],
      };
      await storage.saveModel(model);
      emit({ type: "model", model });
    }
    if (request.type === "import") {
      const checked = modelSchema.parse(request.model);
      network = await restoreCheckpoint(checked.checkpoint);
      if (network.countParams() !== checked.parameters)
        throw new Error("Contagem de parâmetros incompatível.");
      const prediction = infer(network, new Chess());
      if (!Number.isFinite(prediction.value))
        throw new Error("Inferência inválida.");
      const model: ModelRecord = {
        ...checked,
        id: crypto.randomUUID(),
        name: checked.name.slice(0, 50) + " · importado",
        status: "candidate",
        evaluations: [],
        origin: "Importação local (não validada)",
      };
      await storage.saveModel(model);
      emit({ type: "model", model });
    }
    if (request.type === "train") {
      let selected = await storage.model(request.modelId);
      if (!selected) throw new Error("Modelo não encontrado.");
      let config = trainingConfigSchema.parse(request.config);
      if (request.resume) {
        experiment = (await storage.experiments()).find(
          (e) => e.modelId === selected!.id && e.status !== "completed",
        );
        if (!experiment)
          throw new Error("Nenhuma sessão recuperável para esse modelo.");
        config = experiment.config;
      } else {
        selected = await createCandidate(selected, config.learningRate);
        await storage.saveModel(selected);
        emit({ type: "model", model: selected });
        experiment = {
          id: request.id,
          modelId: selected.id,
          createdAt: new Date().toISOString(),
          status: "running",
          config,
          metrics: [],
          logs: [],
          completedGames: 0,
          endings: { rules: 0, budget: 0 },
          checkpoints: 0,
        };
      }
      network = await restoreCheckpoint(selected.checkpoint);
      experiment.status = "running";
      const publish = async () => {
        await storage.saveExperiment(experiment!);
        emit({ type: "experiment", experiment: experiment!, backend });
      };
      const log = (message: string, event = "training") => {
        experiment!.logs.push({
          at: new Date().toISOString(),
          level: "info",
          event,
          message,
        });
      };
      log(
        `Backend ${backend}; ${selected.parameters.toLocaleString()} parâmetros. Pesos não implicam qualidade validada.`,
        "backend",
      );
      await publish();
      for (let i = experiment.completedGames; i < config.games; i++) {
        log(`Iniciando partida ${i + 1}/${config.games}.`, "selfplay");
        await publish();
        const generated = await playGeneratedGame({
          white: (c) => infer(network!, c),
          black: (c) => infer(network!, c),
          simulations: config.simulations,
          maxPlies: config.maxPlies,
          seed: 42 + i * 1000,
          mode: "selfplay",
          beforeMove: gate,
          onMove: (ply, fen) => {
            if (ply % 2 === 0)
              emit({
                type: "progress",
                ply,
                fen,
                message: `Self-play ${i + 1}/${config.games} · ${ply} meias-jogadas reais`,
              });
          },
          whiteName: selected.name,
          blackName: selected.name,
        });
        await storage.saveGame(generated.game);
        await storage.addReplay(generated.examples, config.bufferCapacity);
        experiment.completedGames++;
        if (experiment.endings)
          experiment.endings[
            generated.game.termination === "budget" ? "budget" : "rules"
          ]++;
        log(
          `${generated.game.result?.result}: ${generated.game.result?.reason}. ${generated.examples.length} posições salvas.`,
          "game-complete",
        );
        await publish();
      }
      const buffer = await storage.replay();
      const all = experiment.datasetIds
        ? experiment.datasetIds.map((id) => {
            const e = buffer.find((p) => p.id === id);
            if (!e)
              throw new Error(
                "Dataset do checkpoint foi removido do replay. Inicie uma nova candidata.",
              );
            return e;
          })
        : buffer;
      const gameIds = [...new Set(all.map((e) => e.gameId))];
      const validationIds = new Set(
        experiment.validationGameIds ??
          (gameIds.length >= 2 ? [gameIds.at(-1)!] : []),
      );
      experiment.datasetIds = all.map((e) => e.id);
      experiment.validationGameIds = [...validationIds];
      await publish();
      const train = all.filter((e) => !validationIds.has(e.gameId)),
        validation = all
          .filter((e) => validationIds.has(e.gameId))
          .slice(0, 64);
      if (!train.length)
        throw new Error(
          "Replay buffer vazio. Nenhum treinamento fictício foi executado.",
        );
      log(
        validation.length
          ? "Separação de avaliação por partida; posições da mesma partida não vazam entre conjuntos."
          : "Uma única partida: loss de avaliação indisponível.",
        "dataset",
      );
      const batchesPerEpoch = Math.ceil(train.length / config.batchSize),
        already = experiment.metrics.at(-1)?.batch ?? 0;
      if (batchesPerEpoch * config.epochs > 500)
        throw new Error(
          "Orçamento máximo de 500 lotes por sessão. Reduza épocas ou aumente o lote.",
        );
      let batchIndex = 0,
        bestValidation = Infinity,
        staleEpochs = 0;
      const elapsedOffset = experiment.metrics.at(-1)?.elapsedMs ?? 0;
      for (const metric of experiment.metrics) {
        if (metric.validationLoss !== null) {
          if (metric.validationLoss < bestValidation - 0.0001) {
            bestValidation = metric.validationLoss;
            staleEpochs = 0;
          } else staleEpochs++;
        }
      }
      for (let epoch = 0; epoch < config.epochs; epoch++) {
        if (staleEpochs >= 3) break;
        if ((epoch + 1) * batchesPerEpoch <= already) {
          batchIndex = (epoch + 1) * batchesPerEpoch;
          continue;
        }
        const samples = shuffle(train, epoch + 42);
        for (
          let offset = 0;
          offset < samples.length;
          offset += config.batchSize
        ) {
          if (batchIndex++ < already) continue;
          await gate();
          const batch = samples.slice(offset, offset + config.batchSize);
          const losses = await trainBatch(network, batch);
          selected.completedBatches++;
          experiment.metrics.push({
            batch: batchIndex,
            epoch: epoch + 1,
            ...losses,
            validationLoss:
              offset + config.batchSize >= samples.length
                ? validationLoss(network, validation)
                : null,
            examples: batch.length,
            elapsedMs: elapsedOffset + Date.now() - started,
            memoryBytes: tensorMemory().bytes,
          });
          if (
            batchIndex % config.checkpointEvery === 0 ||
            batchIndex === config.epochs * batchesPerEpoch
          ) {
            selected.checkpoint = await exportCheckpoint(network, {
              preset: selected.preset,
              generation: selected.generation,
              learningRate: config.learningRate,
              completedBatches: selected.completedBatches,
            });
            log(
              `Checkpoint consistente após lote ${batchIndex}; pesos e estado Adam preservados.`,
              "checkpoint",
            );
            if (experiment.checkpoints !== undefined) experiment.checkpoints++;
            await storage.saveTrainingCheckpoint(selected, experiment);
            emit({ type: "model", model: selected });
            emit({ type: "experiment", experiment, backend });
          } else emit({ type: "experiment", experiment, backend });
        }
        const validationValue = experiment.metrics.at(-1)?.validationLoss;
        if (validationValue !== null && validationValue !== undefined) {
          if (validationValue < bestValidation - 0.0001) {
            bestValidation = validationValue;
            staleEpochs = 0;
          } else staleEpochs++;
          if (staleEpochs >= 3) {
            log(
              "Early stopping: três épocas sem queda na loss de avaliação.",
              "early-stop",
            );
            break;
          }
        }
      }
      selected.checkpoint = await exportCheckpoint(network, {
        preset: selected.preset,
        generation: selected.generation,
        learningRate: config.learningRate,
        completedBatches: selected.completedBatches,
      });
      experiment.status = "completed";
      log(
        "Treinamento concluído. Candidata preservada; promoção exige avaliação competitiva.",
        "complete",
      );
      if (experiment.checkpoints !== undefined) experiment.checkpoints++;
      await storage.saveTrainingCheckpoint(selected, experiment);
      emit({ type: "model", model: selected });
      emit({ type: "experiment", experiment, backend });
    }
    if (request.type === "evaluate") {
      const candidate = await storage.model(request.modelId);
      if (!candidate || !candidate.completedBatches)
        throw new Error("Treine a candidata antes de avaliar.");
      const reference = request.opponentId
        ? await storage.model(request.opponentId)
        : undefined;
      if (request.opponentId && !reference)
        throw new Error("Referência não encontrada.");
      const games = Math.max(2, Math.min(16, Math.floor(request.games))),
        sims = Math.max(4, Math.min(128, request.simulations));
      if (games % 2 !== 0)
        throw new Error("Use número par de partidas para alternar cores.");
      network = await restoreCheckpoint(candidate.checkpoint);
      if (reference) opponent = await restoreCheckpoint(reference.checkpoint);
      let wins = 0,
        draws = 0,
        losses = 0;
      const gameIds: string[] = [];
      const evaluationId = crypto.randomUUID();
      const expectedChampion =
        (await storage.models()).find((m) => m.status === "champion")?.id ??
        null;
      for (let i = 0; i < games; i++) {
        const candidateWhite = i % 2 === 0,
          refName = reference?.name ?? "Heurístico fixo";
        const candidateEvaluator = (c: Chess) => infer(network!, c),
          referenceEvaluator = opponent
            ? (c: Chess) => infer(opponent!, c)
            : undefined;
        const { game } = await playGeneratedGame({
          white: candidateWhite ? candidateEvaluator : referenceEvaluator,
          black: candidateWhite ? referenceEvaluator : candidateEvaluator,
          whiteName: candidateWhite ? candidate.name : refName,
          blackName: candidateWhite ? refName : candidate.name,
          simulations: sims,
          maxPlies: Math.min(240, Math.max(16, request.maxPlies)),
          seed: 8000 + i,
          mode: "evaluation",
          beforeMove: gate,
          onMove: (ply) => {
            if (ply % 4 === 0)
              emit({
                type: "progress",
                message: `Avaliação ${i + 1}/${games} · ${ply} meias-jogadas`,
                ply,
              });
          },
        });
        game.evaluationId = evaluationId;
        gameIds.push(game.id);
        await storage.saveGame(game);
        const result = game.result!.result;
        if (result === "1/2-1/2") draws++;
        else if ((result === "1-0") === candidateWhite) wins++;
        else losses++;
        emit({
          type: "progress",
          message: `Avaliação ${i + 1}/${games}: ${game.result!.result} · ${game.result!.reason}`,
        });
      }
      const summary = evaluatePromotion(wins, draws, losses);
      // Only the current champion (or fixed heuristic when no champion) is a promotion reference.
      if ((reference?.id ?? null) !== expectedChampion)
        summary.promoted = false;
      const record = {
        id: evaluationId,
        gameIds,
        conditions: {
          games,
          simulations: sims,
          maxPlies: Math.min(240, Math.max(16, request.maxPlies)),
          opponentHash:
            reference?.checkpoint.hash ?? "heuristic-v1-depth2-100ms",
          candidateHash: candidate.checkpoint.hash,
          reference: reference
            ? "policy/value MCTS"
            : "Negamax depth 2, 100 ms",
        },
        rejectionReason: summary.promoted
          ? undefined
          : (reference?.id ?? null) !== expectedChampion
            ? "A referência usada não é o campeão atual."
            : games < 8
              ? "Amostra inferior a 8 partidas."
              : "Pontuação ou limite Wilson insuficientes.",
        opponent: reference?.id ?? "heuristic",
        ...summary,
        at: new Date().toISOString(),
      };
      candidate.evaluations.push(record);
      await storage.saveModel(candidate);
      if (record.promoted)
        await storage.promote(candidate.id, expectedChampion);
      emit({ type: "evaluation", record, modelId: candidate.id });
      emit({ type: "model", model: (await storage.model(candidate.id))! });
    }
    if (request.type === "tournament") {
      const ids = [...new Set(request.modelIds)];
      if (ids.length < 2 || ids.length > 4)
        throw new Error("Selecione de 2 a 4 participantes únicos.");
      const participants: ModelRecord[] = [];
      for (const id of ids) {
        const m = await storage.model(id);
        if (!m) throw new Error("Participante não encontrado.");
        participants.push(m);
        tournamentNetworks.push(await restoreCheckpoint(m.checkpoint));
      }
      tournament = {
        id: request.id,
        name: "Torneio local · round-robin",
        createdAt: new Date().toISOString(),
        status: "running",
        participants: participants.map((m) => ({
          id: m.id,
          name: m.name,
          hash: m.checkpoint.hash,
        })),
        standings: participants.map((m) => ({
          id: m.id,
          name: m.name,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
        })),
        matches: [],
        simulations: Math.max(4, Math.min(128, request.simulations)),
        maxPlies: Math.max(16, Math.min(240, request.maxPlies)),
      };
      await storage.saveTournament(tournament);
      emit({ type: "tournament", tournament });
      const total = participants.length * (participants.length - 1);
      let count = 0;
      for (let a = 0; a < participants.length; a++)
        for (let b = 0; b < participants.length; b++) {
          if (a === b) continue;
          await gate();
          const { game } = await playGeneratedGame({
            white: (c) => infer(tournamentNetworks[a], c),
            black: (c) => infer(tournamentNetworks[b], c),
            simulations: tournament.simulations,
            maxPlies: tournament.maxPlies,
            seed: 12000 + count,
            mode: "evaluation",
            whiteName: participants[a].name,
            blackName: participants[b].name,
            beforeMove: gate,
            onMove: (ply) =>
              emit({
                type: "progress",
                message: `Torneio ${count + 1}/${total} · ${ply} meias-jogadas`,
              }),
          });
          await storage.saveGame(game);
          tournament.matches.push({
            white: participants[a].id,
            black: participants[b].id,
            gameId: game.id,
            result: game.result!,
          });
          const white = tournament.standings[a],
            black = tournament.standings[b];
          if (game.result!.result === "1/2-1/2") {
            white.draws++;
            black.draws++;
            white.points += 0.5;
            black.points += 0.5;
          } else {
            const w = game.result!.result === "1-0" ? white : black,
              l = w === white ? black : white;
            w.wins++;
            w.points++;
            l.losses++;
          }
          count++;
          await storage.saveTournament(tournament);
          emit({ type: "tournament", tournament });
        }
      tournament.status = "completed";
      await storage.saveTournament(tournament);
      emit({ type: "tournament", tournament });
    }
    emit({ type: "done", id: request.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha neural.";
    if (tournament) {
      tournament.status = cancelled ? "cancelled" : "interrupted";
      try {
        await storage.saveTournament(tournament);
        emit({ type: "tournament", tournament });
      } catch {
        /* Keep original failure. */
      }
    }
    if (experiment) {
      try {
        const durable = (await storage.experiments()).find(
          (e) => e.id === experiment!.id,
        );
        if (durable) experiment = durable;
        experiment.status = cancelled ? "cancelled" : "error";
        experiment.logs.push({
          at: new Date().toISOString(),
          level: "error",
          event: "interrupted",
          message,
        });
        await storage.saveExperiment(experiment);
        emit({ type: "experiment", experiment, backend: "cpu" });
      } catch {
        /* Original storage error is preserved. */
      }
    }
    emit({ type: "error", id: request.id, message });
  } finally {
    network?.optimizer.dispose();
    network?.dispose();
    opponent?.optimizer.dispose();
    opponent?.dispose();
    tournamentNetworks.forEach((n) => {
      n.optimizer.dispose();
      n.dispose();
    });
    busy = false;
  }
};
