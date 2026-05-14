# PariFlow Partners Back

Backend NestJS/Fastify/Prisma do PariFlow Partners.

Data de referencia: `2026-05-14`.

## Estado atual

O backend ja esta alem da fundacao inicial. Ele possui os modulos operacionais
centrais, isolamento por empresa raiz em services principais, homologacao AWS
por IP atras de Apache/PM2/MySQL local e integracao real com o front Flutter.

O que nao deve mais aparecer como pendencia inicial:

- criar empresas, clientes, contratos ou catalogo contratual basico;
- criar People/pessoas, vinculos, ocorrencias, tags ou anexos;
- criar `GET /api/v1/network/graph`;
- criar dashboard operacional da home;
- criar endpoints basicos de agenda, timeline ou relatorios;
- habilitar mock/sample como fallback de runtime.

## Stack

- Node.js 22+
- NestJS 11
- Fastify `5.8.5`
- Prisma `6.8.x`
- MySQL
- Firebase Admin para validar Firebase ID Token
- JWT interno com refresh token rotativo em cookie `HttpOnly`
- Nodemailer/SMTP e adapter WhatsApp Cloud API quando variaveis estiverem configuradas
- Apache reverse proxy
- PM2

Swagger/OpenAPI existe para uso local/controlado, mas deve ficar desligado em
AWS/producao com `SWAGGER_ENABLED=false`.

## Documentacao viva

- [Indice do backend](docs/README.md)
- [Checklist AWS e seguranca](docs/aws-security-checklist.md)
- [Client onboarding e isolamento por tenant](docs/client-onboarding-and-tenant-isolation.md)
- [Calendario compartilhado, banco e notificacoes](docs/calendario-compartilhado-backend.md)
- [Focus Board, hub e agenda](docs/focus-board-hub-agenda.md)
- [Apache reverse proxy](apache/pariflow-back.conf.example)

As pastas externas `D:\DEV\flutter\JOTABE\docs - BACK` e
`D:\DEV\flutter\JOTABE\DPPRO_JOTABE\Documentacao` continuam como referencia de
produto e operacao, mas os documentos essenciais tambem estao agora em
`PariFlow Partners - Back/docs` para manter links do repositorio funcionais.

## Endpoints ativos

### Plataforma

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /api/docs` somente quando `SWAGGER_ENABLED=true`

### Auth e sessao

- `POST /api/v1/auth/session/exchange`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/sensitive-session/start`
- `POST /api/v1/auth/sensitive-session/verify`

### Onboarding de cliente

- `GET /api/v1/public/client-onboarding/options`
- `GET /api/v1/public/client-onboarding/cnpj-status?cnpj=...`
- `GET /api/v1/public/client-onboarding/cnpj/:cnpj/status`
- `POST /api/v1/public/client-onboarding/verification/start`
- `POST /api/v1/public/client-onboarding`
- `GET /api/v1/client-onboarding/requests`
- `POST /api/v1/client-onboarding/requests/:publicId/approve`
- `POST /api/v1/client-onboarding/requests/:publicId/reject`

### Dashboard, empresas, clientes e contratos

- `GET /api/v1/dashboard/home`
- `GET/POST/PATCH/DELETE /api/v1/empresas-prestadoras`
- `GET /api/v1/empresas-prestadoras/:publicId`
- `GET/POST/PATCH/DELETE /api/v1/clientes`
- `GET /api/v1/clientes/:publicId`
- `GET/POST/PATCH/DELETE /api/v1/contratos`
- `GET /api/v1/contratos/:publicId`
- `GET/POST/PATCH/DELETE /api/v1/contratos/tipos`
- `GET/POST/PATCH/DELETE /api/v1/contratos/modelos`
- `GET/POST/PATCH/DELETE /api/v1/contratos/servicos`
- `GET/POST /api/v1/contratos/:publicId/postos`
- `PATCH/DELETE /api/v1/contratos/postos/:positionPublicId`
- `GET/POST /api/v1/contratos/:publicId/documentos`
- `PATCH/DELETE /api/v1/contratos/documentos/:documentPublicId`

### People, dossie, timeline e network

- `GET/POST/PATCH/DELETE /api/v1/pessoas`
- `GET /api/v1/pessoas/:publicId`
- `GET/POST /api/v1/vinculos`
- `GET /api/v1/vinculos/:publicId`
- `POST /api/v1/vinculos/:publicId/movimentacoes`
- `POST /api/v1/vinculos/:publicId/desligamento`
- `GET/POST/PATCH/DELETE /api/v1/ocorrencias`
- `GET /api/v1/ocorrencias/:publicId`
- `GET/POST/PATCH/DELETE /api/v1/tags-entidade`
- `POST /api/v1/tags-entidade/submissions`
- `GET/POST/PATCH/DELETE /api/v1/anexos`
- `GET /api/v1/anexos/:publicId/access`
- `POST /api/v1/anexos/submissions`
- `GET/POST/PATCH/DELETE /api/v1/timeline`
- `GET /api/v1/timeline/:publicId`
- `GET /api/v1/network/graph`

### Agenda, relatorios e notificacoes

- `GET/POST/PATCH/DELETE /api/v1/agenda`
- `GET/POST /api/v1/agenda/non-business-days`
- `DELETE /api/v1/agenda/non-business-days/:publicId`
- `GET /api/v1/agenda/applicability`
- `POST /api/v1/relatorios/executar`
- `notification_outbox` com worker SMTP para e-mail e adapter WhatsApp quando
  `WHATSAPP_*` estiver configurado.

## Contratos importantes

- A API usa prefixo `api/v1`, exceto health.
- Respostas de sucesso passam pelo envelope global `{ data, meta }`.
- Erros passam por `{ error: { code, message, traceId } }`.
- O front sempre trafega `publicId`; ID numerico interno nao deve cruzar a API.
- ACL, tenant, sensivel, anexos e permissoes sao decididos no backend.
- `.env`, secrets Firebase, JWT, SMTP, WhatsApp, AWS e banco nao entram no Git.
- Rotas `*/submissions` ficam desligadas por padrao com
  `PUBLIC_SUBMISSIONS_ENABLED=false`; producao exige `PUBLIC_SUBMISSION_TOKEN`.

## Subida local

```powershell
cd "D:\DEV\flutter\JOTABE\PariFlow Partners - Back"
npm.cmd install
npm.cmd run db:local:setup
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
npm.cmd run prisma:seed
npm.cmd run start:dev
```

Modo local reversivel sem Firebase real:

```powershell
npm.cmd run dev:local-token
```

Esse modo prende a API em loopback, habilita `DEV_AUTH_BYPASS=true` somente no
processo atual e nao altera AWS nem banco real.

Com o back local ativo:

```powershell
cd "D:\DEV\flutter\JOTABE\PariFlow Partners - Front"
.\scripts\run-web-local.ps1 -UseDevToken
```

Swagger local:

```text
http://localhost:3000/api/docs
```

## Firebase Admin e usuarios reais

Para liberar login online:

1. Habilitar Email/Password no Firebase.
2. Criar usuarios reais no Firebase.
3. Aplicar Service Account no `.env` do backend remoto.
4. Conceder perfil interno ao usuario real.
5. Rodar smoke de login real ponta a ponta.
6. Confirmar que `dev-token` segue rejeitado em host publico.

Scripts:

```powershell
.\scripts\apply-firebase-admin-env.ps1 -ServiceAccountJson "C:\caminho\service-account.json"
npm.cmd run user:grant-admin -- --email "admin@empresa.com" --firebaseUid "uid" --name "Administrador"

.\scripts\apply-firebase-admin-aws.ps1 -ServiceAccountJson "C:\caminho\service-account.json"
.\scripts\grant-admin-aws.ps1 -Email "admin@empresa.com" -FirebaseUid "uid" -Name "Administrador"
```

## Seed

O seed e idempotente:

- garante perfis `ADMIN`, `EXECUTIVE`, `LEGAL`, `HR` e `OPERATIONS`;
- garante catalogo basico de servicos;
- cria usuario admin somente se `SEED_ADMIN_EMAIL` estiver preenchido;
- cria dados de exemplo somente com `SEED_ENABLE_SAMPLE_DATA=true`.

Em AWS, `SEED_ENABLE_SAMPLE_DATA=false` deve permanecer falso.

## Pendencias reais

1. Configurar dominio e HTTPS.
2. Criar usuarios reais, conceder perfis internos e validar login real.
3. Trocar `COOKIE_SECURE=true` quando HTTPS estiver ativo.
4. Fechar UX completa de refresh/logout no front e validar sessao longa.
5. Finalizar sensitive-session/step-up para acoes criticas e anexos sensiveis.
6. Ligar storage privado, URL assinada curta e auditoria de download.
7. Evoluir calendario com filtros salvos, preview de audiencia e confirmacao de ciencia.
8. Evoluir relatorios com exportacao, persistencia de modelos e auditoria final.
9. Concluir administracao do registry comercial de CNPJs, WAF/Captcha e SMS.
10. Otimizar `GET /network/graph` com volume real e ACL fina.
11. Definir rotina de backup/restore de banco.
