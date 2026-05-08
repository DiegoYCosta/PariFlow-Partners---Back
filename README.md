# PariFlow Partners Back

Backend NestJS/Fastify/Prisma do PariFlow Partners.

Data de referencia: `2026-05-08`.

## Estado Atual

O backend possui os modulos operacionais centrais e ja foi publicado em
homologacao AWS por IP atras de Apache, PM2 e MySQL local.

O que nao deve mais aparecer como pendencia inicial:

- criar empresas, clientes ou contratos;
- criar People/pessoas;
- criar tags, anexos ou ocorrencias;
- criar `GET /network/graph`;
- criar CRUD basico dos modulos mestre;
- habilitar mock/sample como fallback de runtime.

## Stack

- Node.js 22+
- NestJS
- Fastify `5.8.5`
- Prisma
- MySQL
- Firebase Admin para validar Firebase ID Token
- Apache reverse proxy
- PM2

Swagger/OpenAPI existe para uso local/controlado, mas fica desabilitado em
producao por `SWAGGER_ENABLED=false`.

## Seguranca e Deploy AWS

- [Checklist AWS de seguranca](docs/aws-security-checklist.md)
- [Apache reverse proxy com headers de seguranca](apache/pariflow-back.conf.example)
- `scripts/smoke-aws-security.sh`

Estado remoto verificado:

- `NODE_ENV=production`
- `PREVIEW_AUTH_BYPASS=false`
- `DEV_AUTH_BYPASS=false`
- `SEED_ENABLE_SAMPLE_DATA=false`
- `SWAGGER_ENABLED=false`
- JWT secrets nao usam `change-this-*`
- `COOKIE_SECURE=false` enquanto a homologacao for HTTP por IP

O deploy instala dependencias com `npm ci --omit=optional`, porque o backend
usa Firebase Auth/Admin, mas nao usa Firestore/Storage opcionais do pacote
`firebase-admin`.

## Endpoints Ativos

### Plataforma

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /api/docs` somente quando `SWAGGER_ENABLED=true`

### Auth

- `POST /api/v1/auth/session/exchange`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/sensitive-session/start` reservado/parcial
- `POST /api/v1/auth/sensitive-session/verify` reservado/parcial

### Empresas, Clientes e Contratos

- `GET/POST/PATCH/DELETE /api/v1/empresas-prestadoras`
- `GET /api/v1/empresas-prestadoras/:publicId`
- `GET/POST/PATCH/DELETE /api/v1/clientes`
- `GET /api/v1/clientes/:publicId`
- `GET/POST/PATCH/DELETE /api/v1/contratos`
- `GET /api/v1/contratos/:publicId`

### Catalogo Contratual

- `GET/POST/PATCH/DELETE /api/v1/contratos/tipos`
- `GET/POST/PATCH/DELETE /api/v1/contratos/modelos`
- `GET/POST/PATCH/DELETE /api/v1/contratos/servicos`
- `GET/POST /api/v1/contratos/:publicId/postos`
- `PATCH/DELETE /api/v1/contratos/postos/:positionPublicId`
- `GET/POST /api/v1/contratos/:publicId/documentos`
- `PATCH/DELETE /api/v1/contratos/documentos/:documentPublicId`

### People, Dossie e Network

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
- `POST /api/v1/anexos/submissions`
- `GET /api/v1/network/graph`

## Integracao com o Front

O front consome API real para:

- Companies, Clients e Contracts;
- catalogo contratual;
- People;
- ocorrencias;
- anexos;
- Network.

Regras mantidas:

- front usa `publicId`, nunca ID interno;
- ACL, conteudo sensivel e permissoes sao decididos no backend;
- Service Account Firebase, JWT secrets, senha de banco e chaves AWS ficam
  somente no backend/infra;
- `.env` real nao entra no Git;
- host publico exige Firebase Admin configurado e build sem `dev-token`.

## Subida Local

```powershell
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

Esse modo define `NODE_ENV=development`, prende a API em loopback e habilita
`DEV_AUTH_BYPASS=true` somente no processo atual. Nao altera AWS nem banco real.

Com o back local ativo:

```powershell
cd "D:\DEV\flutter\JOTABE\PariFlow Partners - Front"
.\scripts\run-web-local.ps1 -UseDevToken
```

Swagger local:

```text
http://localhost:3000/api/docs
```

## Firebase Admin e Usuarios Reais

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
```

## Seed

O seed e idempotente:

- garante perfis `ADMIN`, `EXECUTIVE`, `LEGAL`, `HR` e `OPERATIONS`;
- garante catalogo basico de servicos;
- cria usuario admin somente se `SEED_ADMIN_EMAIL` estiver preenchido;
- cria dados de exemplo somente com `SEED_ENABLE_SAMPLE_DATA=true`.

Em AWS, `SEED_ENABLE_SAMPLE_DATA=false` deve permanecer falso.

## Pendencias Reais

1. Configurar dominio e HTTPS.
2. Configurar Firebase Admin na EC2 e criar usuarios reais.
3. Integrar o front ao refresh/logout quando a UX de sessao for fechada.
4. Completar sensitive-session/step-up.
5. Ligar storage privado e download rastreavel para anexos sensiveis.
6. Implementar auditoria operacional e eventos de seguranca.
7. Implementar relatorios e consultas executivas.
8. Enriquecer detalhes de clientes/prestadoras quando o front precisar.
9. Otimizar `GET /network/graph` com dados reais e regras de ACL.
10. Definir backup/restore de banco.
