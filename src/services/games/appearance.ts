export type Appearance = {
  preset: "classic" | "mineral" | "bronze" | "contrast" | "custom";
  light: string;
  dark: string;
  white: string;
  black: string;
  border: string;
  selected: string;
  lastMove: string;
  legal: string;
  check: string;
  finish: "matte" | "polished" | "metallic";
};
export const THEMES: Record<
  Exclude<Appearance["preset"], "custom">,
  Appearance
> = {
  classic: {
    preset: "classic",
    light: "#d3be97",
    dark: "#563825",
    white: "#e0ccb0",
    black: "#30373a",
    border: "#433023",
    selected: "#e6c477",
    lastMove: "#bb9a58",
    legal: "#e7cb8a",
    check: "#da786b",
    finish: "polished",
  },
  mineral: {
    preset: "mineral",
    light: "#cdd3d1",
    dark: "#4b6068",
    white: "#f1eee8",
    black: "#303943",
    border: "#334248",
    selected: "#f1d493",
    lastMove: "#93b4bd",
    legal: "#f2d58c",
    check: "#e57979",
    finish: "matte",
  },
  bronze: {
    preset: "bronze",
    light: "#cebb91",
    dark: "#34574c",
    white: "#ece0bd",
    black: "#927244",
    border: "#423c2e",
    selected: "#efd48d",
    lastMove: "#a8b697",
    legal: "#f4dfa0",
    check: "#ef8580",
    finish: "metallic",
  },
  contrast: {
    preset: "contrast",
    light: "#e8d9bb",
    dark: "#153d69",
    white: "#ffffff",
    black: "#11151b",
    border: "#14263b",
    selected: "#ffe08a",
    lastMove: "#89bada",
    legal: "#fff1b4",
    check: "#ff8b7e",
    finish: "matte",
  },
};
export function normalizeAppearance(input?: Partial<Appearance>): Appearance {
  const base =
    THEMES[
      input?.preset && input.preset !== "custom" && input.preset in THEMES
        ? input.preset
        : "classic"
    ];
  const next = { ...base };
  for (const key of [
    "light",
    "dark",
    "white",
    "black",
    "border",
    "selected",
    "lastMove",
    "legal",
    "check",
  ] as const)
    if (/^#[0-9a-f]{6}$/i.test(input?.[key] ?? "")) next[key] = input![key]!;
  if (["matte", "polished", "metallic"].includes(input?.finish ?? ""))
    next.finish = input!.finish!;
  if (input?.preset === "custom") next.preset = "custom";
  return next;
}
function luminance(color: string) {
  const c = [1, 3, 5]
    .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
export function contrastRatio(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
