# Treino local e recuperação

## Experimento curto

Crie Tiny no Neural Lab. Use 2 jogos, 4 simulações, 8 meias-jogadas, 1 época, lote 8 e checkpoint a cada lote para verificar o pipeline rapidamente. Com esse limite curto, posições não encerradas naturalmente viram empates adjudicados. O experimento demonstra dados/gradientes/persistência; não demonstra aumento de força.

Para dados mais variados, aumente simulações e orçamento de jogadas gradualmente, conforme a capacidade do dispositivo. Nenhuma configuração garante melhora. Standard/Research podem ser mais lentos e consumir mais memória. Fechar a aba encerra a execução; treinamento não continua em um servidor.

## Sequência executada

1. Clona pesos de origem para **nova candidata**, com geração incrementada. O otimizador começa novo em um experimento novo; a origem é preservada.
2. Self-play usa a própria rede + MCTS. `chess.js` garante legalidade e finais. Cada posição registra FEN causal, cor, repetição, distribuição real de visitas e ID da partida.
3. Ao concluir o jogo, o resultado atribui value +1 / −1 / 0 por perspectiva. Um limite de jogadas causa empate **adjudicado**, identificado no arquivo, nunca um mate inventado.
4. Guarda PGN e amostras no replay limitado. Deduplicação por chave cobre regravações de dados humanos; novas partidas de self-play são registros próprios.
5. Divide dados por ID de partida: a última partida serve à validação se houver pelo menos duas; demais partidas alimentam treino. Com uma partida, validação é `null`, não um número fabricado. O conjunto de validação é limitado a 64 posições; não há teste externo separado nesta versão.
6. Embaralha de modo reprodutível por época, calcula cross-entropy/MSE com Adam e mede losses, número de exemplos, memória estimada de tensores e tempo.
7. Salva pesos e estado Adam junto ao cursor do experimento, atomicamente, na cadência configurada. Guarda IDs do dataset e jogos reservados à validação para retomar a mesma ordem.
8. Early stopping após três épocas sem queda de pelo menos 0,0001 na loss de validação; checkpoints anteriores e métricas permanecem. O melhor checkpoint por loss não é automaticamente selecionado como campeão.
9. Sessão termina em candidata. Avaliação competitiva é uma tarefa separada.

## Pausa, cancelamento e reload

Pausa é cooperativa entre jogadas/lotes. Cancelamento preserva o último checkpoint **durável** e descarta mudanças posteriores não confirmadas. Recarregar não reinicia automaticamente um loop: a sessão anterior aparece recuperável/interrompida. **Retomar checkpoint** restaura pesos, momentos Adam, cursor e dataset. Um replay apagado/evicto produz erro claro e exige um novo experimento; não há retomada falsa usando dados diferentes.

Pausa automática é solicitada ao ocultar a aba, se ativada. O orçamento de 10 minutos mede tempo de parede daquela execução, incluindo pausa; retomar depois de atingir o orçamento inicia uma nova execução a partir do checkpoint. O limite de configuração/500 lotes evita sessões ilimitadas. Erros numéricos e de quota nunca promovem candidatas.

## Checkpoints

JSON `chess-evolution-v1`, encoding 1, actionSpace 4672, preset/geração/learning rate/lotes, tensores com shape/dtype/valores e slots do otimizador. Hash SHA-256 é calculado sobre o conteúdo canônico sem `hash`. Importação limita 10 MiB, formas, valores finitos, arquitetura e parâmetros; verifica hash e uma inferência real. Hash detecta alteração/incompatibilidade, não é uma assinatura de autoria.

Modelos importados recebem novo ID, status candidato e avaliações vazias. Não se confia em alegações de força do arquivo. Exportação permite migrar pesos para outros dispositivos/origens. SQL remoto guarda apenas fichas, não os pesos.

## Aprendizado pessoal

Desativado por padrão. Com consentimento em Ajustes, salvar uma partida humana concluída inclui posições anteriores às jogadas humanas, política one-hot da jogada observada e alvo de resultado. Em jogo local de duas pessoas inclui ambas as cores. PGNs importados e partidas inacabadas não entram automaticamente. Dados continuam no dispositivo; podem ser removidos com **Limpar replay buffer**. Esse treino supervisionado pode imitar erros humanos; melhoria exige avaliação independente.

## Avaliação e torneios

A candidata treinada enfrenta o campeão atual ou heurístico fixo quando não existe campeão. Cores alternam; partidas, resultados e adjudicações são arquivados. É possível comparar outra referência, mas essa comparação não promove se não for o campeão atual. Amostras de 2/4 jogos são somente exploratórias. Exige ≥8 partidas, ≥60% dos pontos e limite Wilson >50% para promoção.

O heurístico de referência usa profundidade 2 e orçamento de 100 ms por jogada; a comparação depende do hardware/tempo de busca. Redes usam as simulações configuradas, limitadas também por tempo. Adjudicações podem dominar amostras curtas. A diferença Elo é apenas estimativa local; não é rating global nem resultado estatisticamente robusto em amostras pequenas.

Torneios alternam cada par nas duas cores, 2–4 participantes, 2–12 partidas. Pausa/cancelamento preservam jogos e classificação concluídos. Não há retomada de um torneio cancelado no meio de uma partida nesta versão; iniciar outro é explícito. Torneios nunca substituem a regra de promoção.

## Limites deliberados

Sem treinamento distribuído, augmentation de simetrias, currículo de posições, teacher externo, geração infinita, arena de milhares de partidas ou benchmark Elo externo. O fluxo é real e inspecionável, mas a escala local pequena não replica AlphaZero nem garante vencer o baseline. Loss menor demonstra ajuste aos alvos, não qualidade de xadrez.
