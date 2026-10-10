# IA: regras, representação e busca

## Baseline verificável

O heurístico avalia material (peão 100, cavalo 320, bispo 335, torre 500, dama 900 centipeões), centralização/desenvolvimento, estrutura de peões, atividade de torres, segurança do rei e mobilidade. Negamax converte o sinal para o lado a jogar. Mate usa valor separado, com preferência por mate mais rápido. Não é rede neural nem usa movimentos aleatórios como substituição.

Negamax aplica alpha-beta, aprofundamento iterativo, quiescência (capturas/promoções e todas as evasões em xeque), ordenação de capturas/promoções/xeques, limite de tempo/nós e tabela de transposição. Zobrist representa peças, lado, direitos de roque e en passant; histórico e contador de meias-jogadas também entram na chave, conservadoramente, para não reutilizar avaliações em contextos de repetição incompatíveis. Essa escolha reduz compartilhamento entre caminhos transpostos. Ao terminar o orçamento, retorna a última profundidade completamente pesquisada; uma jogada legal determinística cobre o caso de interrupção antes da primeira profundidade.

## Entrada 8 × 8 × 20

Coordenadas usam a perspectiva do lado a jogar. Para pretas, o tabuleiro gira 180°. Não há informação futura nos canais.

| Canais | Conteúdo |
| --- | --- |
| 0–5 | Peão, cavalo, bispo, torre, dama, rei próprios |
| 6–11 | As seis peças adversárias |
| 12 | Cor absoluta: brancas 1 / pretas 0 |
| 13–16 | Roques K/Q próprios e K/Q adversários |
| 17 | Casa en passant |
| 18 | Contador de meias-jogadas / 150, limitado a 1 |
| 19 | Repetições anteriores / 4, limitado a 1 |

FEN isolado não fornece histórico de repetição. Inferência em um jogo com PGN calcula o histórico; amostras self-play guardam o contador junto ao FEN. Amostras humanas usam a posição anterior à jogada, uma política one-hot e o resultado como alvo; a versão atual usa repetição 1 nessas amostras supervisionadas.

## Ações: 64 × 73 = 4.672

Cada casa de origem tem 73 planos: 8 direções de raio × 7 distâncias, 8 saltos de cavalo e 9 subpromoções (cavalo/bispo/torre × três direções). Promoção a dama usa o plano de raio e é decodificada pelo peão/posição. `actionToMove` recebe o contexto do tabuleiro. A codificação é reversível para movimentos legais, incluindo roques, en passant e promoções nas duas cores.

Antes de escolher uma jogada, probabilidades ilegais são removidas. Valores não finitos são rejeitados/zerados e o conjunto legal é renormalizado. Se todas as probabilidades legais subestimarem numericamente para zero, usa prior uniforme **sobre jogadas legais**, ainda dentro de MCTS; isso não é um fallback de motor aleatório.

## Rede

Stem Conv3×3/ReLU → blocos residuais de duas Conv3×3 + soma/ReLU. Regularização L2 nas convoluções. Head de política Conv1×1 com 73 canais → reshape 4.672 → softmax; head de valor flatten → dense 32/ReLU → dense 1/tanh.

| Preset | Filtros | Blocos residuais |
| --- | ---: | ---: |
| Tiny | 8 | 1 |
| Standard | 16 | 2 |
| Research | 24 | 3 |

Presets são realmente arquiteturas distintas. Não se promete que Research seja mais forte. Inicialização Glorot é reproduzível com seed. Batch normalization foi omitida para manter treino com lotes pequenos estável e checkpoints simples. Não há transformer, LLM, quantização ou pesos pré-treinados.

Adam minimiza cross-entropy da policy e MSE do value, com regularização. `trainOnBatch` produz a loss total; losses por head são medidas explicitamente antes da atualização, sem preencher métricas ausentes com zeros. Validação usa `model.evaluate` em posições de partidas separadas. Inferência e medições usam `tf.tidy`/dispose; testes verificam que inferências repetidas não acumulam tensores e que os pesos realmente mudam.

## MCTS / PUCT

Uma folha é expandida com policy/value. Valores são sempre do lado a jogar naquela folha. Backup inverte o sinal a cada nível; seleção no pai usa o negativo da média do filho mais termo exploratório `1.45 × prior × sqrt(visitasPai)/(1+visitasFilho)`. Terminais: mate −1 para o lado sem jogada; empate 0. Busca tem limites de simulação, tempo e profundidade 24.

Em jogo/avaliação usa a maior contagem de visitas, com desempate determinístico. Self-play amostra a distribuição de visitas com temperatura 1 nas primeiras 16 meias-jogadas e seed explícita, depois escolhe a maior visita. Os alvos de política são visitas reais, não logits inventados. A UI distingue **centipeões heurísticos** de **valor neural/MCTS [−1,1]**.

Backend WebGL é tentado com smoke test de gradiente Conv2D em OffscreenCanvas; se indisponível, CPU é inicializado. WebGPU não está habilitado. O navegador pode não suportar determinados operadores WebGL: uma falha interrompe a sessão com erro e preserva o último checkpoint, sem promoção automática ou perda do modelo de origem.

## Avaliação de força

Pontuação = `(vitórias + 0.5 × empates) / partidas`. Estimativa de diferença Elo = `400 log10(p/(1−p))`, somente para 0 < p < 1. É uma comparação local, não Elo oficial. Para promoção: mínimo de 8 jogos, ≥60% de pontos e limite inferior Wilson 95% >50%, contra o campeão atual (ou heurístico se não houver campeão). Wilson com empates fracionários é uma aproximação conservadora de triagem, não inferência estatística completa para resultados multinomiais.

Uma loss menor não promove modelo. Torneios também não promovem. Importações apagam alegações de campeão/avaliações e entram como candidatas não validadas. Rollback só aceita uma versão anteriormente validada no registro local.

Referências: [TensorFlow.js](https://js.tensorflow.org/api/latest/), [guia de treinamento](https://www.tensorflow.org/js/guide/train_models), [chess.js](https://github.com/jhlywa/chess.js), [renderização R3F sob demanda](https://r3f.docs.pmnd.rs/advanced/scaling-performance).
