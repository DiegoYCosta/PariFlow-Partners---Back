# PariFlow Partners Back

Base do backend do PariFlow Partners, alinhada ao plano em `docs/preparacao-backend-e-integracao-front.md`.

## Leitura correta em `2026-05-02`

- o backend ja nao esta apenas em scaffolding;
- `auth/session/exchange` e `auth/me` ja estao ativos;
- os modulos de empresas prestadoras, clientes, contratos, pessoas, vinculos, tags de entidade e anexos ja existem;
- o front atual ja possui shell CRM, workspace de `People` e preview funcional de `Network`;
- os principais itens realmente abertos agora sao `refresh/logout/sensitive session`, `GET /network/graph`, ocorrencias, auditoria, relatorios e o ciclo final de storage/download protegido.

## Stack

- NestJS
- Fastify
- Prisma
- MySQL
- Firebase Admin
- Swagger/OpenAPI

## Materiais de seguranca para AWS

Os materiais de seguranca do primeiro deploy ficam neste repositorio porque a
maior parte dos controles reais esta no backend, no Apache, no PM2, no MySQL e
nas variaveis de ambiente.

- [Checklist AWS de seguranca](docs/aws-security-checklist.md)
- [Apache reverse proxy com headers de seguranca](apache/pariflow-back.conf.example)
- `.env.aws*` fica ignorado pelo Git; use `.env.aws.preview` local para homologacao por IP e copie para `.env` na EC2.
- `scripts/smoke-aws-security.sh`: smoke test de health, auth, rotas protegidas e headers.

O front so precisa de ajuste de seguranca se a API ficar em outro host. Nesse
caso, buildar o Flutter com:

```bash
flutter build web --release --dart-define=PARIFLOW_API_BASE_URL=https://seu-dominio/api/v1
```

No modo preferencial, Apache serve front e API no mesmo host, entao o front usa
`/api/v1` automaticamente em build release.

## O que ja existe

- bootstrap do backend com `api/v1`
- `GET /health`
- `POST /api/v1/auth/session/exchange`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout` e rotas de `sensitive-session` ja expostas como trilha parcial/reservada
- `GET/POST /api/v1/empresas-prestadoras`
- `GET/POST /api/v1/clientes`
- `GET/POST /api/v1/contratos`
- `GET/POST /api/v1/pessoas`
- `GET/POST /api/v1/vinculos`
- `POST /api/v1/vinculos/:publicId/movimentacoes`
- `POST /api/v1/vinculos/:publicId/desligamento`
- `POST /api/v1/tags-entidade/submissions`
- `GET/POST/PATCH/DELETE /api/v1/tags-entidade`
- `POST /api/v1/anexos/submissions`
- `GET/POST/PATCH/DELETE /api/v1/anexos`
- filtro global de erros no formato padrao da API
- interceptor global que envelopa respostas com `traceId`
- `PrismaService` global e schema Prisma inicial
- exemplo de configuracao Apache e PM2

## O que continua aberto de verdade

- persistir o ciclo final de `usuario_sistema`, `perfil_acesso` e `refresh_tokens`
- concluir o runtime de `refresh`, `logout` e `sensitive session`
- ligar storage privado, download protegido e step-up para anexos sensiveis
- criar os modulos de ocorrencias, auditoria e relatorios
- publicar o endpoint canonico `GET /network/graph`
- expandir migracoes e seeds dos modulos restantes

## Endpoints de dominio ja disponiveis

### Empresas prestadoras

- `GET /api/v1/empresas-prestadoras`
- `GET /api/v1/empresas-prestadoras/:publicId`
- `POST /api/v1/empresas-prestadoras`

### Clientes contratantes

- `GET /api/v1/clientes`
- `GET /api/v1/clientes/:publicId`
- `POST /api/v1/clientes`

### Contratos

- `GET /api/v1/contratos`
- `GET /api/v1/contratos/:publicId`
- `POST /api/v1/contratos`

### Pessoas

- `GET /api/v1/pessoas`
- `GET /api/v1/pessoas/:publicId`
- `POST /api/v1/pessoas`

### Vinculos

- `GET /api/v1/vinculos`
- `GET /api/v1/vinculos/:publicId`
- `POST /api/v1/vinculos`
- `POST /api/v1/vinculos/:publicId/movimentacoes`
- `POST /api/v1/vinculos/:publicId/desligamento`

### Tags sensiveis por entidade

- `POST /api/v1/tags-entidade/submissions`
- `POST /api/v1/tags-entidade`
- `GET /api/v1/tags-entidade`
- `GET /api/v1/tags-entidade/:publicId`
- `PATCH /api/v1/tags-entidade/:publicId`
- `DELETE /api/v1/tags-entidade/:publicId`

### Anexos protegidos ou formais

- `POST /api/v1/anexos/submissions`
- `POST /api/v1/anexos`
- `GET /api/v1/anexos`
- `GET /api/v1/anexos/:publicId`
- `PATCH /api/v1/anexos/:publicId`
- `DELETE /api/v1/anexos/:publicId`

## Regra de compatibilidade com o front atual

O front atual ja nao esta em wireframe puro. Hoje ele ja possui:

- shell CRM ativo;
- feature explicita de clientes;
- tela de `People` com `Employment Links`, bloco sensivel e anexos;
- preview funcional de `Network` com quatro faixas.

Por isso, o backend nao deve mais ser documentado como base para um front ainda inexistente. A leitura correta agora e:

- manter contratos ativos estaveis;
- enriquecer payload sem quebrar o legado;
- fechar os endpoints que faltam para `People`, `Network`, ocorrencias e auditoria.

## Subida local

1. Copie `.env.example` para `.env`
2. Instale dependencias:

```powershell
npm.cmd install
```

3. Suba a instancia MySQL local do projeto:

```powershell
npm.cmd run db:local:setup
```

4. Gere o client do Prisma:

```powershell
npm.cmd run prisma:generate
```

5. Aplique a migration inicial no banco:

```powershell
npm.cmd run prisma:migrate:deploy
```

6. Rode o seed inicial:

```powershell
npm.cmd run prisma:seed
```

7. Rode em desenvolvimento:

```powershell
npm.cmd run start:dev
```

8. Swagger:

```text
http://localhost:3000/api/docs
```

## Regra de banco no scaffold atual

Se `.env` ainda nao existir ou `DATABASE_URL` nao estiver preenchida:

- `GET /health` continua respondendo;
- `auth/session/exchange` continua funcionando com `dev-token` em ambiente local;
- endpoints de dominio com Prisma respondem `503`.

## Banco local do projeto

O repositorio ja traz scripts para uma instancia MySQL isolada em `127.0.0.1:3308`, sem depender do servico MySQL principal da maquina:

```powershell
npm.cmd run db:local:setup
npm.cmd run db:local:stop
```

Arquivos locais dessa instancia ficam em `.local/mysql/` e nao entram no versionamento.

## Seed inicial

O seed atual faz tres coisas:

- garante os perfis `ADMIN`, `EXECUTIVE`, `LEGAL`, `HR` e `OPERATIONS`;
- garante um catalogo basico de servicos;
- cria usuario admin inicial e dados de exemplo apenas se voce informar pelas variaveis de ambiente.

Variaveis relacionadas:

```text
SEED_ADMIN_NAME=Administrador Inicial
SEED_ADMIN_EMAIL=
SEED_ADMIN_FIREBASE_UID=
SEED_ENABLE_SAMPLE_DATA=false
```

Regras:

- sem `SEED_ADMIN_EMAIL`, nenhum usuario admin e criado;
- com `SEED_ENABLE_SAMPLE_DATA=true`, o seed cria uma prestadora, um cliente, um contrato, um posto, uma pessoa e um vinculo de exemplo;
- o seed e idempotente, entao pode ser executado novamente sem duplicar os registros base.
