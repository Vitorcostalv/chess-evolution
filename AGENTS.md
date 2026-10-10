# CHESS // EVOLUTION

- TypeScript strict. Keep rules, search, neural training, storage and rendering separate.
- chess.js is authoritative for legal moves. No random fallback disguised as neural play.
- Training and evaluation metrics must come from completed calculations and games.
- Never promote a candidate from loss alone; require adequate competitive evaluation.
- Heavy computations run in bounded workers; stale results must not change a new game.
- Preserve local-first operation, IndexedDB checkpoints, 2D fallback and reduced motion.
- No Docker, mandatory resident services or paid AI dependencies.
- Run typecheck, lint, relevant tests and build before publishing.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
