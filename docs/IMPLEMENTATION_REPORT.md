# Relatório de implementação — CHESS // EVOLUTION

Data: 9 de outubro de 2026. Projeto separado em `C:\Users\jasmi\OneDrive\projetos\WorkSpace\chess-evolution`.

## Entregas implementadas

Arena 3D procedural e fallback 2D; regras reais; humano × IA, IA × IA e jogo local; relógios, promoção, histórico, FEN/PGN/análise, salvar/exportar/revisar. Páginas Neural Lab, Modelos, Partidas, Torneios e Ajustes. Fontes locais, responsive, movimento reduzido, controles acessíveis em 2D e perfis gráficos.

Motor heurístico determinístico + Negamax alpha-beta/iterativo/quiescência/TT/Zobrist. MCTS/PUCT com policy/value residual TensorFlow.js. Encoding 20 canais e 4.672 ações reversíveis para movimentos legais. Tiny, Standard e Research produzem redes distintas. Workers executam busca, self-play, treino, avaliação e torneios com limites explícitos.

Treino efetivo por Adam: amostras legais, alvos de visitas/resultado, replay limitado, divisão por partidas, validação e early stopping. Checkpoints incluem pesos, slots do otimizador, hash e cursor/dataset persistidos atomicamente. Pausa, cancelamento, recuperação e exportação/importação não fingem aprendizado. Partidas humanas concluídas entram apenas com consentimento. Candidatas preservam a origem e não são promovidas por loss.

Avaliação com cores alternadas, vitórias/empates/derrotas reais, pontuação, Wilson e estimativa Elo relativa. Gate de promoção exige evidência suficiente sobre referência atual; rollback aceita apenas campeão anterior validado. Torneios 2–4 modelos geram classificação de partidas realmente jogadas.

IndexedDB migrável guarda modelos/partidas/experimentos/replay/torneios/sessão de arena. APIs opcionais PostgreSQL/Prisma têm sessão assinada de navegador, filtros de proprietário, validação, limites de payload/quota/rate e migração SQL. Pesos ficam locais. A implantação pública inicial deixa backup remoto desativado.

## Decisões frente à especificação

Sem Docker, Redis ou serviço dedicado. Next/Vercel entrega UI e APIs curtas; treinamento permanece no visitante. CSS próprio/Lucide substituem a preferência por Tailwind/component library, mantendo acessibilidade e a linguagem visual grafite/marfim/bronze. Modelos e fontes procedurais/locais evitam dependências externas no carregamento.

Rede compacta residual sem batch normalization, adequada a lotes pequenos. TensorFlow Core/Layers e CPU/WebGL são usados diretamente, sem dependências CLI/converter/data. Nenhuma API paga, LLM, modelo remoto ou jogada aleatória disfarçada como neural.

## Parcial / fora deste release

| Requisito avançado | Estado e limite |
| --- | --- |
| Força progressiva comprovada | Pipeline real, mas nenhum aumento de Elo comprovado por esta entrega. Depende de treino/arena suficientes. |
| WebGPU | Não habilitado; WebGL verificado e fallback CPU. |
| Treinamento distribuído | Desativado. Nenhum worker remoto residente ou agrupamento de dispositivos. |
| Conta/sincronização entre dispositivos | Backup opcional por sessão privada; sem OAuth/email, recuperação de conta ou transferência automática. |
| Banco PostgreSQL em produção | Schema/migração/APIs implementados; nenhum banco provisionado, integração real não executada. |
| Sync remoto de tensores | Não implementado deliberadamente. Pesos migram por export/import local. |
| Treino avançado | Sem augmentation/currículo/teacher externo/checkpoint de melhor loss separado/benchmark de milhares de jogos. |
| Torneio interrompido | Jogos concluídos preservados; não retoma a partida incompleta. |
| Regras de reivindicação FIDE | Três repetições e 50 movimentos são tratados como empate automático por este modo recreativo. 75 movimentos suportado com mate prioritário. Sem UI de reivindicação. |
| Relógio competitivo | Timer recreativo local de um segundo; pausa/reload não constituem relógio certificado de torneio. |
| Renderização avançada | Sem path tracing/reflexos dinâmicos ou GLTF; seis modelos procedurais, luzes/sombras e animação de movimentos. |
| Métricas de memória | Bytes de tensores TF, estimativa; não mede toda a memória JS/GPU do navegador. |

Partidas com orçamento curto são explicitamente **empates adjudicados**. Esses alvos podem concentrar draws e reduzir utilidade do value head. Uma candidata pode piorar; testes verificam que amostra insuficiente/resultado inferior não a promovem. Modelo inicial é **sem treino**, não um campeão pronto.

## Validação

44 testes de unidade/integração local passaram. Os 5 E2E Playwright passaram contra o build de produção local e novamente contra a **URL pública da Vercel**: 3D/2D, jogo completo/mobile, worker heurístico, treino/eval/torneio, reload, cancelamento/retomada e modo remoto desativado. `lint`, `typecheck`, `test` e `build` passaram antes de publicação. [GitHub Actions](https://github.com/Vitorcostalv/chess-evolution/actions/runs/38011616757) executou os mesmos checks e E2E com sucesso em Linux/Node 22; produção Vercel usou Node 24. `npm audit --omit=dev`: zero vulnerabilidades. O audit completo ainda relata 5 achados high na cadeia de glob/braces do tooling ESLint/Next; a versão corrente de braces não oferece correção compatível. Não são dependências do runtime de produção; não foi aplicado downgrade forçado de Next.

Integração SQL real, rating competitivo e amplo benchmark de dispositivos não foram executados. Não são apresentados como concluídos.

## Publicação

- Repositório público: [Vitorcostalv/chess-evolution](https://github.com/Vitorcostalv/chess-evolution).
- Produção: [chess-evolution.vercel.app](https://chess-evolution.vercel.app).
- Integração GitHub → Vercel conectada, branch `main` em produção.
- `/api/health`: HTTP 200, `status: ok`, `training: browser-workers`, `remoteSync: false`.
- `/api/remote/status`: HTTP 200, `enabled: false`, `weightsSync: false`.
- Sem banco provisionado, Docker, chaves de IA pagas ou serviço de treino residente.
- Segredos `.env.local`/`.vercel` ignorados pelo Git; somente `.env.example` foi publicado.
- Capturas de desktop/mobile incluídas no README/documentação; servidores locais de prévia encerrados após QA.
