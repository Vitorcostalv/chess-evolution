# Verificação

## Comandos

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

E2E inicia Next dev em porta 3100 se não houver servidor. Para validar um build estável:

```bash
npm run build
npm start -- --port 3101
```

Em outro terminal PowerShell:

```powershell
$env:E2E_BASE_URL='http://localhost:3101'
npm run test:e2e
```

Também aceita a URL pública em `E2E_BASE_URL`, sem iniciar servidor local. Playwright usa perfis isolados: os modelos/dados de um teste não contaminam outro. Chromium usa SwiftShader para testar canvas no ambiente de CI; isso não é um benchmark de GPU física.

## Testes de unidade / integração local

55 verificações cobrem:

- Rejeição de movimento ilegal, partida completa até mate, roque e roque através de xeque, en passant/undo, quatro promoções, afogamento, material, repetição, 50/75 movimentos, PGN/FEN de posições customizadas.
- Encoder finito/determinístico, coordenadas invertíveis, política reversível nas duas cores, roques/promoções, ausência de colisão em estados alcançáveis e máscara legal normalizada.
- Negamax encontrando mate em um, integridade do tabuleiro após busca/cancelamento, tempo/nós, sinal do backup MCTS, terminais e recusa de valores neurais não finitos.
- Zobrist com contexto; gate de promoção rejeitando candidatas inferiores, empates e amostras pequenas.
- **Gradiente TensorFlow real** alterando pesos; exportação/restauração equivalentes; próxima atualização Adam equivalente após restore; inferências repetidas sem acúmulo de tensores; detecção de checkpoint alterado.
- Self-play real gerando PGN/posições/políticas, adjudicação explícita, limites de replay, persistência/migrações IndexedDB e promoção sem evidência rejeitada.
- Identidades 3D preservadas em captura, roque e en passant; aprendizagem pessoal exige consentimento e partida concluída, com posições causais e alvo de resultado.
- Incremento único, relógio por tempo decorrido, bandeira, partida sem relógio, undo/redo, invalidação de transições antigas, snapshots de captura/en passant/roque/promoção, replay puro, migração de aparência, soluções legais dos exercícios e perspectiva da revisão.
- Candidata com pesos independentes e preservação do registro original com status campeão. Essa fixture testa imutabilidade, sem simular uma promoção competitiva.

Dados sintéticos usados em testes são fixtures declaradas. Métricas exibidas no produto vêm dos workers, não dessas fixtures. Nenhum teste de aprendizado usa mock de gradiente ou copia valores esperados para simular treinamento.

## E2E

1. Canvas 3D renderiza; alternar 2D, jogar `e4`, receber jogada legal do worker heurístico e recuperar a partida pausada após reload.
2. Inicializar Tiny, executar dois jogos de self-play e um lote real, recarregar checkpoint, executar avaliação com duas cores e recusar promoção por amostra insuficiente. Executar torneio round-robin e recuperar classificação/partidas.
3. Após checkpoint real, pausar/cancelar/recarregar/retomar treino até os 32 lotes configurados, com cursor consistente.
4. Em viewport 390×844, jogar até xeque-mate, salvar/abrir biblioteca PGN e confirmar ausência de overflow horizontal.
5. API remota declara desativada e rejeita origem estrangeira.
6. Jogada `e4` por raycast real no tabuleiro 3D; troca de câmera e lado; perfis baixo/alto; viewport mobile sem overflow; capturas do tabuleiro e ausência de erros de execução.
7. Ausência de WebGL simulada explicitamente: fallback correto, tentativa de 3D, 32 peças SVG e persistência do tema Mineral/animações desativadas.
8. Partida local animada 3+2 até mate, replay manual/automático e revisão real em Worker sem alterar o resultado original.
9. Captura en passant com remoção na casa correta, identidades do roque e escolha visual de promoção no tabuleiro 2D.
10. Exercício resolvido por mate legal, reinício e preservação da partida da Arena.
11. Avanço de um lance de IA com busca real e nova partida recusando resposta antiga.
12. Duas gerações realmente treinadas e avaliadas sob condições equivalentes; comparação, PGNs assistíveis e distinção persistida de encerramento por orçamento.
13. Tabuleiro 2D contido na área de jogo depois de iniciar a partida, sem cobrir relógios ou controles, em 1150×775, 1366×768, 1920×1080, 390×844 e 844×390. Verifica formato quadrado, 64 casas, ausência de overflow horizontal e uma jogada por clique.

Screenshots e traces são gravados em `test-results` (ignorado no Git). Capturas selecionadas em `docs/assets` documentam a interface real. A documentação registra o estado dos checks no relatório de implementação.

## Limites da verificação

Não é uma medição de rating, escalabilidade distribuída ou desempenho em todo navegador/GPU. Integração PostgreSQL real permanece não executada quando o modo remoto está desativado. Um pequeno número de jogos adjudicados de E2E testa o fluxo e jamais comprova força. Logs de depreciação de Three/Drei não são resultados de xadrez. Recursos devem ser verificados em hardware físico adicional antes de ampliar presets/volume.
