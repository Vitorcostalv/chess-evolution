# CHESS // EVOLUTION — evolução local

Implementação e validação local: 9 de outubro de 2026. Base: commit `286d7f3`. Este documento pertence ao CHESS // EVOLUTION, não ao SONDA. A publicação do código no GitHub foi autorizada em 10 de outubro de 2026. Não foi executado deploy manual nem verificada a implantação desta versão na Vercel nesta etapa.

## Inspeção e estado inicial

O repositório existente usa Next.js App Router, TypeScript strict, Zustand, chess.js, Three/R3F/Drei, IndexedDB v4 e workers para busca/treinamento. A inspeção confirmou animação 3D por aproximação exponencial, remoção imediata de capturas, Unicode no 2D, áudio no momento da confirmação do domínio e relógios decrementados em intervalos fixos. O fallback de erro de renderização não atualizava o cabeçalho nem as instruções.

Lint, typecheck, 44 testes, build e os 6 testes de navegador do estado inicial passaram. O texto renderizado externamente não prova falha universal de 3D: ausência de WebGL e erros de inicialização são cenários distintos. O navegador local com SwiftShader renderizou 3D. A ferramenta de leitura externa não conseguiu abrir a referência pública; o código e o navegador local foram usados para a investigação.

## Implementação

- **Apresentação das peças:** snapshots com identidades existentes, curvas de aceleração/desaceleração, duração normal 180–300 ms (padrão 240), rápida 120 ms ou desativada; movimento reduzido tem prioridade. Peão capturado permanece em sua casa durante a aproximação e desaparece discretamente no final; en passant usa a casa do peão capturado. Cavalo salta em arco no 3D; rei e torre do roque compartilham o início/duração. Promoção tem escolhas SVG. Tokens invalidam conclusões antigas e som ao mudar de partida. O domínio confirma a jogada e incrementa o relógio antes da animação; entradas humanas são bloqueadas durante a transição.
- **2D e temas:** seis desenhos SVG autorais MIT, contornos por cor e camada com identidades estáveis. Clássico, Mineral, Bronze e Alto contraste; nove cores independentes e acabamentos fosco/polido/metálico no 3D. Prévia, aviso de contraste baixo, padrões restauráveis e migração das preferências antigas. Última jogada, destinos e xeque têm marcas de formas diferentes; xeque tem indicação textual.
- **Câmera/fallback:** transições de 260 ms, restauração, limites de órbita/zoom e filtro de deslocamento de clique. O enquadramento isométrico considera largura e altura separadamente para ampliar o tabuleiro em telas largas sem cortar o celular. Detecção exige WebGL2, usado pela versão instalada de Three. Ausência, erro de renderização e perda de contexto passam para 2D, atualizam modo/instruções e oferecem nova tentativa com mensagem curta.
- **Layout:** introdução compacta, relógios junto ao tabuleiro, turno destacado, configuração recolhida após a primeira jogada, abas de configuração/jogadas/análise, controles essenciais junto ao tabuleiro e painel recolhível no celular. Histórico não rola automaticamente a página.
- **Relógios (política v2):** 3+2, 5+3 e 10+5, antigos 5/10/30 minutos e sem relógio. Tempo real decorrido, incremento único na confirmação, recusa de jogada após a bandeira e empate quando o adversário restante não pode dar mate pelos casos de material tratados. Desfazer/refazer restaura snapshots de relógios sem reaplicar incremento. Sessões antigas usam incremento zero. Ao sair da Arena, a partida é pausada e respostas/animações pendentes são invalidadas.
- **Leitura e ajuda:** capturadas, saldo material em peões com valores explícitos, xeque e motivo final. Dificuldades por orçamento real, sem Elo arbitrário; modelo/geração/estado de treino identificados. Dicas progressivas de peça, destino e linha vêm de busca real e pausam a partida.
- **IA × IA:** velocidade contemplativa/normal/acelerada, pausa e avanço de um lance. Acelerada dispensa animações; buscas não aguardam o fim visual. A partida pausa durante uma tarefa neural ativa e pode continuar quando ela estiver pausada/concluída.
- **Replay:** início/anterior/próximo/final, reprodução automática 0,5×/1×/2×/4× e navegação SAN. Cursor separado não altera PGN, resultado, sessão ou clocks do jogo original. Continuação separada salva o original e cria outro jogo. Arquivo e avaliação mantêm o resultado informado, inclusive adjudicação por orçamento.
- **Revisão:** Worker separado, progresso/cancelamento, até 240 meias-jogadas e 60 segundos. Mesmas condições de Negamax (profundidade 2, 150 ms por posição), valores em peões com perspectiva fixa das brancas; gráfico, maiores mudanças, jogada realizada, sugerida, PV e alternativas quando produzidas. Não utiliza value neural convertido em centipawns, classificação automática de erro ou precisão sem fórmula.
- **Posições:** página `/practice` com FEN, reinício, continuação contra heurístico, final torre/rei e dois mates em um autorais. As soluções são executadas nos testes e quaisquer mates legais resolvem os desafios. Estado isolado da Arena, sem gravação no replay pessoal ou histórico de partidas normais.
- **Neural Lab:** fluxo explícito gerar → preparar → treinar candidata → checkpoint → avaliar → promover/preservar; presets Celular/Desktop/Avançado; exemplos, checkpoints, épocas, losses e encerramentos reais. Modelos antigos sem novos contadores são identificados como não registrados. Candidata tem cópia independente dos pesos; o campeão não é editado. Replay pessoal mostra partidas e exemplos atualmente retidos e insuficiência para divisão por partidas.
- **Comparação:** cada avaliação nova registra hashes, referência, orçamento, quantidade de jogos e IDs de PGNs. Duas gerações são comparadas somente quando essas condições coincidem; partidas podem ser abertas na Arena. Avaliações antigas sem condições não são chamadas equivalentes. Motivo de rejeição/promoção é mostrado. Declaração explícita de encerramento `rules`/`budget` preserva a adjudicação no armazenamento; o tratamento de resultado zero no treino não foi alterado.

## Arquivos principais

| Área | Arquivos |
| --- | --- |
| Arena/estado | `src/components/arena.tsx`, `src/stores/game.ts`, `src/services/games/clocks.ts` |
| Aparência/animação | `board-2d.tsx`, `board-3d.tsx`, `chess-materials.ts`, `piece-svg.tsx`, `appearance-panel.tsx`, `use-board-motion.ts`, `services/games/appearance.ts`, `presentation.ts` |
| Replay/revisão | `game-review.tsx`, `services/games/review.ts`, `workers/review.worker.ts` |
| Exercícios | `components/practice.tsx`, `app/practice/page.tsx`, `services/games/exercises.ts` |
| Neural | `lab.tsx`, `neural-evidence.tsx`, `workers/training.worker.ts`, `ai/self-play/game.ts`, `services/models/candidate.ts` |
| Preferências/layout | `stores/preferences.ts`, `types/domain.ts`, `settings.tsx`, `shell.tsx`, `app/globals.css` |
| Testes | `tests/evolution.test.ts`, `tests/e2e/evolution.spec.ts`, cenários E2E existentes adaptados às transições/controles nomeados |

O esquema de lojas IndexedDB continua v4: campos novos são aditivos e preferências antigas recebem defaults. O formato de checkpoint/encoding/ação continua v1; pesos, algoritmo de treinamento e gate competitivo não foram modificados. Política do relógio mudou para v2; condições de análise são documentadas acima. APIs, banco e implantação não foram alterados.

## Verificação

- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado, TypeScript strict.
- `npm test`: 8 arquivos, 55 testes aprovados, nenhum ignorado.
- `npm run build`: aprovado; 14 páginas geradas, incluindo `/practice`, sem conexão obrigatória a banco.
- `npm run test:e2e`: 12 cenários aprovados no build final, em 1,6 minuto; nenhum ignorado. Inclui treino/avaliação reais, restauração, 2D/3D, fallback, temas, relógio, replay/revisão, movimentos especiais, exercícios e comparação equivalente de gerações.
- `git diff --check` e verificação Prettier dos arquivos do último ajuste: aprovados.

Uma rodada anterior do novo enquadramento passou em 11 cenários e falhou no clique por raycast do 3D: o teste calculava coordenadas finais enquanto a câmera ainda se ajustava ao layout compacto. O teste passou isoladamente após aguardar os 350 ms que abrangem a transição de 260 ms; a jogada continua sendo feita por clique/raycast real, sem acesso direto ao estado.

Capturas locais em 1366×768 e 390×844 confirmaram ausência de overflow horizontal. O painel do tabuleiro inteiro terminou dentro da primeira tela nessas resoluções. A prévia e os testes usam Chromium com SwiftShader. Não foram executados benchmarks em GPU física ou validação de áudio em hardware.

## Limites concretos

Chromium/SwiftShader verifica funcionalidade/renderização, não desempenho em GPU física, Safari/iOS ou todos os drivers. O áudio é sintetizado e depende da permissão de reprodução do navegador. A revisão usa orçamento curto e profundidade alcançada pode variar por posição; o gráfico é exploratório e não mede rating/precisão. O relógio é local/recreativo, sem certificação de competição; a interface mantém empates automáticos por repetição/50 movimentos da versão anterior.

Os exercícios são uma coleção inicial autoral de três posições, não um catálogo de milhares de táticas. Comparações entre versões antigas sem metadados exigem novas avaliações. A contagem pessoal corresponde ao replay atualmente retido, não a dados já descartados pelo limite. Não há multiplayer online, conta entre dispositivos, WebGPU ou treinamento distribuído. Não há novo aumento de força de jogo comprovado. Backup remoto permanece desativado.

## Executar e conferir

Node.js 22 ou superior; não exige Docker ou variáveis para o modo local.

```powershell
npm ci
npm run db:generate
npm run dev
```

Abra `http://localhost:3000`. Use Ajustes para temas/animações; Arena para relógios e replay; Posições para exercícios; Neural Lab para sessões reais. Revisão calculada fica disponível ao pausar ou concluir a partida.

```powershell
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run build
npm start -- --port 3132
```

Em outro terminal:

```powershell
$env:E2E_BASE_URL='http://localhost:3132'
npm run test:e2e
```

Dados de testes são isolados por navegador. A fixture de status campeão no teste unitário verifica imutabilidade; não é uma promoção competitiva, métrica exibida ou dado de produção.

## Evidências visuais locais

### Correção de contenção do 2D — 10 de outubro de 2026

Depois de iniciar a partida, a Arena compactava a altura disponível, mas o 2D continuava calculando seu tamanho somente pela largura. O tabuleiro ultrapassava a área de jogo e encobria relógios e controles. A área agora é um container de tamanho; o tabuleiro usa o menor limite entre sua largura e altura, preservando o quadrado e a prévia de aparência.

O novo teste `tests/e2e/layout.spec.ts` reproduziu a falha antes da correção em 1150×775. Depois da correção, verifica contenção, ausência de sobreposição, 64 casas, ausência de overflow horizontal e interação em cinco tamanhos de tela. Lint, typecheck e build passaram; os 13 cenários de navegador passaram no build local em 1,3 minuto. Testes unitários não foram repetidos nesta correção de CSS; os 55 aprovados acima pertencem à validação anterior.

[Captura da correção em 1150×775](assets/board-2d-contained.png).

Capturas reais do build local; não representam uma publicação nova em produção.

| Captura | Evidência |
| --- | --- |
| [Desktop 1366×768](assets/evolution-desktop.png) | Arena 3D, relógios e controles do tabuleiro visíveis |
| [Celular 390×844](assets/evolution-mobile.png) | Arena 3D e controles essenciais, sem overflow horizontal |
| [Peças SVG no celular](assets/evolution-mobile-svg.png) | Desenhos 2D próprios e turno destacado |
| [Aparência](assets/evolution-appearance.png) | Tema Mineral persistido e personalização |
| [Revisão calculada](assets/evolution-review.png) | Resultado real de mate, curva e linhas do worker |
| [Posições](assets/evolution-practice.png) | Exercícios isolados e entrada FEN |
