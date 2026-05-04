# PariFlow Partners Back

Backend NestJS/Fastify/Prisma do PariFlow Partners.

Data de referencia: `2026-05-04`.

## Estado Atual

O backend ja possui os modulos operacionais centrais e esta preparado para a
primeira homologacao em AWS EC2 com Apache, PM2 e MySQL local.

O que nao deve mais aparecer como pendencia inicial:

- criar empresas, clientes ou contratos;
- criar People/pessoas;
- criar tags ou anexos;
- criar ocorrencias;
- criar `GET /network/graph`;
- criar CRUD basico dos modulos mestre.

## Stack

- Node.js 22+
- NestJS
- Fastify
- Prisma
- MySQL
- Firebase Admin
- Swagger/OpenAPI
- Apache reverse proxy
- PM2

## Materiais de Seguranca e Deploy AWS

- [Checklist AWS de seguranca](docs/aws-security-checklist.md)
- [Apache reverse proxy com headers de seguranca](apache/pariflow-back.conf.example)
- `scripts/smoke-aws-security.sh`

Arquivos `.env.aws*` ficam ignorados pelo Git. O arquivo local
`.env.aws.preview` pode ser usado como base para copiar o `.env` da EC2 na
homologacao privada por IP.

O front so precisa de ajuste se a API ficar em outro host:

```bash
flutter build web --release --dart-define=PARIFLOW_API_BASE_URL=https://dominio/api/v1
```

No modo preferencial, Apache serve front em `/` e API em `/api/v1` no mesmo
host.

## Endpoints Ativos

### Plataforma

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- Swagger em `/api/docs`

### Auth

- `POST /api/v1/auth/session/exchange`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh` reservado/parcial
- `POST /api/v1/auth/logout` reservado/parcial
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

## Pendencias Reais

1. Executar homologacao AWS com `.env` real, migrations, seed, PM2 e Apache.
2. Trocar preview auth por Firebase real no front e manter
   `PREVIEW_AUTH_BYPASS=false` em producao publica.
3. Completar refresh/logout/sensitive-session.
4. Ligar storage privado, download rastreavel e step-up para anexos sensiveis.
5. Implementar auditoria operacional e eventos de seguranca.
6. Implementar relatorios e consultas executivas.
7. Enriquecer detalhes de clientes/prestadoras quando o front precisar de
   contexto relacional sem chamadas auxiliares.
8. Otimizar `GET /network/graph` com dados reais e regras de ACL.

## Subida Local

```powershell
npm.cmd install
npm.cmd run db:local:setup
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
npm.cmd run prisma:seed
npm.cmd run start:dev
```

Swagger local:

```text
http://localhost:3000/api/docs
```

## Banco Local do Projeto

O repositorio traz scripts para MySQL local isolado em `127.0.0.1:3308`:

```powershell
npm.cmd run db:local:setup
npm.cmd run db:local:stop
```

## Seed

O seed e idempotente:

- garante perfis `ADMIN`, `EXECUTIVE`, `LEGAL`, `HR` e `OPERATIONS`;
- garante catalogo basico de servicos;
- cria usuario admin somente se `SEED_ADMIN_EMAIL` estiver preenchido;
- cria dados de exemplo somente com `SEED_ENABLE_SAMPLE_DATA=true`.
