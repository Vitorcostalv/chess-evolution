export const EXERCISES = [
  {
    id: "queen-mate",
    name: "Rede de mate · dama e rei",
    fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
    goal: "mate-one",
    solution: "Qg7#",
    description:
      "Encontre um mate em uma jogada. O rei branco dá apoio à dama.",
  },
  {
    id: "bishop-mate",
    name: "Coordenação · dama e bispo",
    fen: "6rk/5Qpp/8/8/2B5/8/8/6K1 w - - 0 1",
    goal: "mate-one",
    solution: "Qg8#",
    description:
      "Encontre um mate em uma jogada usando a coordenação das peças.",
  },
  {
    id: "rook-ending",
    name: "Final básico · torre e rei",
    fen: "8/7k/5K2/8/8/8/8/R7 w - - 0 1",
    goal: "ending",
    solution: null,
    description:
      "Pratique o final de torre contra o motor. Evite afogamento e aproxime seu rei.",
  },
] as const;
