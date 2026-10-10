import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  StoredGame,
  ModelRecord,
  Experiment,
  TrainingExample,
  Preferences,
  Tournament,
  ArenaSession,
} from "@/types/domain";
interface EvolutionDB extends DBSchema {
  games: { key: string; value: StoredGame };
  models: { key: string; value: ModelRecord };
  experiments: { key: string; value: Experiment };
  replay: { key: string; value: TrainingExample };
  preferences: { key: string; value: Preferences };
  tournaments: { key: string; value: Tournament };
  sessions: { key: string; value: ArenaSession };
}
let connection: Promise<IDBPDatabase<EvolutionDB>> | undefined;
export function database() {
  if (!connection)
    connection = openDB<EvolutionDB>("chess-evolution", 4, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("games", { keyPath: "id" });
          db.createObjectStore("models", { keyPath: "id" });
          db.createObjectStore("preferences");
        }
        if (oldVersion < 2) {
          db.createObjectStore("experiments", { keyPath: "id" });
          db.createObjectStore("replay", { keyPath: "id" });
        }
        if (oldVersion < 3)
          db.createObjectStore("tournaments", { keyPath: "id" });
        if (oldVersion < 4) db.createObjectStore("sessions");
      },
      blocking() {
        connection?.then((db) => db.close());
        connection = undefined;
      },
      terminated() {
        connection = undefined;
      },
    }).catch((error) => {
      connection = undefined;
      throw new Error(
        `Armazenamento local indisponível: ${error instanceof Error ? error.message : "IndexedDB"}`,
      );
    });
  return connection;
}
export const storage = {
  async session() {
    return (await database()).get("sessions", "arena");
  },
  async saveSession(value: ArenaSession) {
    await (await database()).put("sessions", value, "arena");
  },
  async tournaments() {
    return (await (await database()).getAll("tournaments")).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  },
  async saveTournament(value: Tournament) {
    const db = await database();
    if (
      !(await db.get("tournaments", value.id)) &&
      (await db.count("tournaments")) >= 20
    )
      throw new Error("Limite de 20 torneios locais.");
    await db.put("tournaments", value);
  },
  async games() {
    return (await (await database()).getAll("games")).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  },
  async saveGame(game: StoredGame) {
    const db = await database();
    if (!(await db.get("games", game.id)) && (await db.count("games")) >= 200)
      throw new Error(
        "Limite de 200 partidas locais. Exclua ou exporte partidas antigas.",
      );
    await db.put("games", game);
  },
  async deleteGame(id: string) {
    await (await database()).delete("games", id);
  },
  async models() {
    return (await (await database()).getAll("models")).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  },
  async model(id: string) {
    return (await database()).get("models", id);
  },
  async saveModel(model: ModelRecord) {
    const db = await database();
    if (!(await db.get("models", model.id)) && (await db.count("models")) >= 32)
      throw new Error("Limite de 32 modelos locais.");
    await db.put("models", model);
  },
  async deleteModel(id: string) {
    await (await database()).delete("models", id);
  },
  async preferences() {
    return (await database()).get("preferences", "main");
  },
  async savePreferences(value: Preferences) {
    await (await database()).put("preferences", value, "main");
  },
  async experiments() {
    return (await (await database()).getAll("experiments")).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  },
  async saveExperiment(value: Experiment) {
    const db = await database();
    const tx = db.transaction("experiments", "readwrite");
    const all = await tx.store.getAll();
    if (all.length >= 40 && !all.some((r) => r.id === value.id)) {
      all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      await tx.store.delete(all[0].id);
    }
    await tx.store.put({
      ...value,
      logs: value.logs.slice(-300),
      metrics: value.metrics.slice(-500),
    });
    await tx.done;
  },
  async saveTrainingCheckpoint(model: ModelRecord, experiment: Experiment) {
    const tx = (await database()).transaction(
      ["models", "experiments"],
      "readwrite",
    );
    await tx.objectStore("models").put(model);
    await tx
      .objectStore("experiments")
      .put({ ...experiment, logs: experiment.logs.slice(-300) });
    await tx.done;
  },
  async replay() {
    return (await database()).getAll("replay");
  },
  async addReplay(examples: TrainingExample[], capacity = 2048) {
    const db = await database(),
      tx = db.transaction("replay", "readwrite");
    for (const e of examples) await tx.store.put(e);
    const all = await tx.store.getAll();
    if (all.length > capacity) {
      all.sort((a, b) => a.id.localeCompare(b.id));
      for (const e of all.slice(0, all.length - capacity))
        await tx.store.delete(e.id);
    }
    await tx.done;
  },
  async clearReplay() {
    await (await database()).clear("replay");
  },
  async rollback(id: string, expectedChampion: string | null) {
    const tx = (await database()).transaction("models", "readwrite"),
      all = await tx.store.getAll(),
      current = all.find((m) => m.status === "champion"),
      target = all.find((m) => m.id === id);
    if (
      (current?.id ?? null) !== expectedChampion ||
      target?.status !== "archived" ||
      !target.evaluations.some((e) => e.promoted)
    ) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new Error(
        "Rollback exige um campeão anterior validado e registro consistente.",
      );
    }
    if (current) await tx.store.put({ ...current, status: "archived" });
    await tx.store.put({ ...target, status: "champion" });
    await tx.done;
  },
  async promote(id: string, expectedChampion: string | null) {
    const db = await database(),
      tx = db.transaction("models", "readwrite"),
      all = await tx.store.getAll(),
      current = all.find((m) => m.status === "champion");
    if ((current?.id ?? null) !== expectedChampion) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new Error("O campeão mudou. Execute uma nova avaliação.");
    }
    const candidate = all.find((m) => m.id === id);
    if (!candidate || !candidate.evaluations.at(-1)?.promoted) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new Error("Modelo sem avaliação suficiente para promoção.");
    }
    if (current) await tx.store.put({ ...current, status: "archived" });
    await tx.store.put({ ...candidate, status: "champion" });
    await tx.done;
  },
};
