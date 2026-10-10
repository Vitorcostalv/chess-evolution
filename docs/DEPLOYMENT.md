# Deploy sem Docker

## Vercel

O projeto é Next.js App Router. Install `npm install` / build `npm run build`, pasta raiz do repositório e Node.js 22+. Fontes e workers entram no build. Não configure `DATABASE_URL` se quiser apenas o modo local.

```bash
gh repo create Vitorcostalv/chess-evolution --public --source . --remote origin --push
vercel link --yes --project chess-evolution --scope vitorcostalvs-projects
vercel --prod --yes --scope vitorcostalvs-projects
```

A integração Git conecta `main` à produção e branches a previews. URL canônica: **https://chess-evolution.vercel.app**. Consulte `/api/health`: armazenamento IndexedDB e treino browser-workers são explícitos. `/api/remote/status` informa se backup remoto está configurado.

Nenhuma função Vercel fica treinando modelos, portanto não depende de duração longa, Docker, Redis ou serviços pagos de IA. Uma aba fechada para o treino; seus checkpoints continuam disponíveis no mesmo navegador e origem.

## PostgreSQL opcional

Use PostgreSQL acessível por URL, hospedado pelo provedor escolhido, com pooling apropriado a funções serverless. Não foi provisionado banco para a implantação local inicial.

Variáveis **server-only**:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | PostgreSQL conectado ao Prisma |
| `AUTH_SECRET` | ≥32 caracteres aleatórios para HMAC de sessão/rate keys |
| `APP_ORIGIN` | Origem exata autorizada, por exemplo `https://seu-dominio.vercel.app` |

Não prefixe segredos com `NEXT_PUBLIC_`. Não versione `.env`.

```bash
npm run db:generate
npm run db:migrate
npm run build
```

`db:migrate` aplica `prisma/migrations` ao banco configurado. Execute a migração antes de habilitar a UI remota. O build apenas gera cliente Prisma; não abre conexão nem aplica migrações. `AUTH_SECRET` ausente/curto ou `DATABASE_URL` ausente deixam o modo remoto desativado.

## Contrato remoto

| Método / rota | Função |
| --- | --- |
| GET `/api/remote/status` | Disponibilidade, tipo de autenticação, ausência de sync de pesos |
| POST `/api/remote/session` | Cria/renova sessão privada assinada de 30 dias |
| GET `/api/remote/backup` | Até 200 PGNs e 32 fichas pertencentes à sessão |
| POST `/api/remote/backup` | Upsert de um PGN ou ficha, por proprietário/localId |
| DELETE `/api/remote/backup` | Apaga somente o backup do proprietário atual |

Origem obrigatória em mutações; rejeição de cross-site; cookie HttpOnly/SameSite Strict/Secure em produção; validação Zod, leitura streaming limitada a 256 KiB, PGN limitado a 64.000 caracteres; taxa de 30 requisições/minuto com incremento PostgreSQL atômico. Quotas de entidades são protegidas por transação serializable. Erros do banco não expõem URLs/segredos e não removem dados locais.

Na UI, envio manual limita o lote às 10 partidas e 10 fichas mais recentes. Restore recupera PGNs da sessão; fichas não restauram pesos. Não há email/senha, OAuth, recuperação de conta, transferência automática de identidade entre dispositivos ou upload de tensores. Perder o cookie perde o vínculo com o backup; exportações locais continuam sendo o caminho de migração.

## Segurança e verificações

CSP same-origin para assets, workers self/blob, sem APIs/fontes remotas; `unsafe-eval` permanece por compatibilidade TensorFlow/WebGL. X-Content-Type-Options, frame denial, referrer e permissions policy estão definidos. Checkpoints não são executáveis e são limitados antes de reconstrução.

Na implantação inicial, testes de API cobrem modo desativado e rejeição de origem. Não há validação de integração contra PostgreSQL real sem um banco configurado; isso deve ser testado antes de ativar backup em produção. Treinamento distribuído permanece desativado.

O lockfile fixa dependências. `npm audit --omit=dev` deve ser executado para revisar produção; também revise tooling separadamente. Não aplique `npm audit fix --force` se isso rebaixar Next ou quebrar APIs de treino. A versão inicial atualiza o runner e utiliza módulos TensorFlow sem ferramentas CLI não utilizadas.
