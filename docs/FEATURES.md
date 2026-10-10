# Funcionalidades — CHESS // EVOLUTION

## Resumão

Uma plataforma de xadrez que reúne jogo, análise e experimentação com inteligência artificial. Você pode jogar contra o motor, assistir a duas IAs, criar uma rede neural, treiná-la com partidas que ela mesma gera, comparar resultados e organizar torneios entre modelos. O processamento e os dados ficam no seu navegador: não exige Docker nem assinatura de IA.

## Arena e apresentação

- Humano × IA, IA × IA com escolha independente do motor de cada lado, e dois jogadores no mesmo dispositivo.
- Escolha de brancas ou pretas; relógios de 5, 10 ou 30 minutos; pausar, continuar e iniciar nova partida.
- Tabuleiro 3D com seis peças procedurais: curvas suaves, cavalo esculpido, bispo com abertura na mitra, torre com ameias curvas, coroa da dama e cruz do rei com bordas suaves.
- Materiais de marfim e ébano, veios de madeira, moldura arredondada, filete bronze e coordenadas na borda.
- Iluminação de estúdio, reflexos de ambiente gerados localmente, sombras suaves nos perfis médio/alto e animação das jogadas.
- Arrastar para orbitar, rolar para aproximar, inverter lados e alternar entre câmera isométrica e superior. Enquadramento ortográfico adaptado à tela.
- Perfis baixo, médio e alto ajustam geometria, resolução, ambiente e sombras. Modo baixo dispensa sombras e mapa de ambiente.
- Alternativa 2D com teclado; fallback para dispositivos sem WebGL; interface responsiva e respeito à preferência de movimento reduzido.
- Seleção de peças, indicação de destinos legais, desfazer/refazer, histórico de lances e salvar a partida.
- Importação de posição FEN; análise da posição com pontuação, linha principal, nós analisados e tempo efetivamente gasto.

## Regras e motores

- Validação de jogadas por chess.js, roque, en passant e promoção para dama, torre, bispo ou cavalo.
- Xeque, xeque-mate, afogamento, material insuficiente, repetição e regras de 50/75 movimentos. No modo recreativo, três repetições e 50 movimentos encerram automaticamente: não há interface de reivindicação FIDE.
- Motor heurístico com avaliação de material, posicionamento e mobilidade.
- Busca Negamax/alpha-beta, aprofundamento iterativo, quiescência, ordenação de movimentos e tabela de transposição sensível ao histórico.
- Busca MCTS/PUCT com políticas restritas às jogadas legais e avaliação policy/value da rede. Profundidade ou simulações configuráveis conforme o algoritmo.
- Buscas em workers, limites de execução e cancelamento; resultados antigos não alteram uma partida nova.

## Neural Lab

- Inicialização de redes residuais TensorFlow.js nos presets Tiny, Standard e Research. Modelos recém-criados são identificados como sem treino.
- Self-play real: geração de partidas, políticas de visitas da busca e alvos de resultado.
- Configuração de partidas, simulações por jogada, limite de meias-jogadas, épocas, lote, taxa de aprendizado, tamanho do replay e frequência de checkpoint.
- Treinamento Adam com perdas de política/valor calculadas, divisão de treino/validação por partida e interrupção por falta de melhora na validação.
- Métricas de loss, loss de validação, épocas, lotes, nós e bytes de tensores; gráfico e registros do experimento.
- Pausar, cancelar e retomar um checkpoint consistente; persistência conjunta de pesos, estado do otimizador, amostras e cursor do treino.
- Histórico de experimentos e replay limitado para controlar armazenamento e trabalho.
- Aprendizado pessoal opcional: partidas humanas concluídas podem alimentar o replay com consentimento, desativado por padrão.
- Execução local com WebGL ou fallback CPU, sem API de IA paga.

## Avaliação e modelos

- Biblioteca local com origem, preset, geração, parâmetros, lotes de treino, hash e avaliações do modelo.
- Selecionar um modelo para jogar; exportar/importar checkpoints JSON com tensores e estado Adam; validar integridade SHA-256 e compatibilidade.
- Excluir modelos preservando o campeão atual; restaurar um campeão anterior validado.
- Avaliação competitiva com cores alternadas contra o heurístico ou outro modelo, registrando partidas, vitórias, empates, derrotas e pontuação.
- Estimativa de diferença Elo local e intervalo Wilson; não são um rating oficial.
- Promoção conservadora somente contra a referência adequada: pelo menos 8 partidas, 60% dos pontos e limite inferior Wilson de 95% acima de 50%.
- Reduzir a loss ou importar um arquivo não transforma automaticamente uma rede em campeã.

## Torneios e partidas

- Round-robin entre 2 a 4 modelos, com confronto em cores alternadas e quantidade configurável de partidas.
- Classificação por pontos, vitórias, empates e derrotas; pausa/cancelamento; resultados concluídos permanecem salvos.
- Biblioteca de partidas da arena, self-play, avaliações e torneios.
- Importação PGN por arquivo ou texto, exportação PGN, exclusão e revisão na arena com histórico navegável.
- Salvamento manual e automático de partidas concluídas; recuperação da sessão com relógio pausado ao recarregar.

## Ajustes, dados e infraestrutura

- Preferências de gráficos, tabuleiro, câmera, dicas e som de movimentos.
- Opção de pausar treino quando a aba fica em segundo plano.
- Consentimento para aprendizado pessoal e limpeza do replay sem apagar modelos ou partidas.
- IndexedDB guarda modelos, pesos, jogos, experimentos, torneios, preferências e sessão local; importação/exportação permite transferência manual.
- Fontes, texturas e ambiente gráfico locais/procedurais; nenhum download de HDR ou modelos 3D de terceiros.
- Código aberto no GitHub e implantação na Vercel; não requer Docker, Redis ou servidor dedicado de treinamento.
- API opcional de backup de metadados/PGNs via PostgreSQL/Prisma, com sessão assinada, isolamento de dados e limites. **Desativada na implantação pública atual; não sincroniza pesos.**

## Limites atuais

Não há multiplayer online, login entre dispositivos, treinamento distribuído nem WebGPU habilitado. A força de uma rede depende de treino e avaliação suficientes; não existe garantia de vencer o heurístico ou um jogador. Partidas cortadas pelo orçamento de jogadas são registradas como empates adjudicados. Torneios preservam jogos concluídos, mas não retomam uma partida interrompida. O relógio é recreativo. Limpar os dados do navegador apaga o armazenamento local: exporte modelos/PGNs para conservar cópias.

Fluxo sugerido: jogar na Arena → criar e treinar um modelo Tiny no Lab → avaliar a candidata → comparar modelos em Torneios → exportar os checkpoints e PGNs que quiser preservar.
