"use client";
import { create } from "zustand";
import { DEFAULT_PREFERENCES, type Preferences } from "@/types/domain";
import { storage } from "@/services/storage/database";
import { normalizeAppearance } from "@/services/games/appearance";
export function migratePreferences(value: Partial<Preferences>): Preferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...value,
    appearance: normalizeAppearance(value.appearance),
    animation: ["normal", "fast", "off"].includes(value.animation ?? "")
      ? value.animation!
      : "normal",
    animationDuration: Number.isFinite(value.animationDuration)
      ? Math.max(180, Math.min(300, value.animationDuration!))
      : 240,
  };
}
export const usePreferences = create<{
  value: Preferences;
  error: string | null;
  load: () => Promise<void>;
  update: (input: Partial<Preferences>) => Promise<void>;
}>((set, get) => ({
  value: DEFAULT_PREFERENCES,
  error: null,
  load: async () => {
    try {
      const value = await storage.preferences();
      if (value) set({ value: migratePreferences(value) });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Falha no armazenamento.",
      });
    }
  },
  update: async (input) => {
    const value = migratePreferences({ ...get().value, ...input });
    set({ value });
    try {
      await storage.savePreferences(value);
      set({ error: null });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Preferências não salvas.",
      });
    }
  },
}));
