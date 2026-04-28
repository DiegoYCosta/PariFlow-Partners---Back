# PariFlow Partners Back

Base do backend do PariFlow Partners, alinhada ao plano em [docs/preparacao-backend-e-integracao-front.md](docs/preparacao-backend-e-integracao-front.md).

## Stack

- NestJS
- Fastify
- Prisma
- MySQL
- Firebase Admin
- Swagger/OpenAPI

## O que ja existe

- bootstrap do backend com `api/v1`
- `GET /health`
- `POST /api/v1/auth/session/exchange`
- `GET /api/v1/auth/me`
- `GET/POST /api/v1/empresas-prestadoras`
- `GET/POST /api/v1/clientes`
- `GET/POST /api/v1/contratos`
- filtro global de erros no formato padrao da API
- interceptor global que envelopa respostas com `traceId`
- `PrismaService` global e schema Prisma inicial
- exemplo de configuracao Apache e PM2

## O que ainda e proximo passo

- persistir `usuario_sistema`, `perfil_acesso` e `refresh_tokens`
- implementar `refresh`, `logout` e `sensitive session`
- criar os proximos modulos de dominio: pessoas, vinculos, ocorrencias e anexos
- ligar storage privado para anexos
- expandir as proximas migracoes e seeds dos modulos restantes

## Subida local

1. Copie `.env.example` para `.env`
2. Instale dependencias:

```powershell
npm.cmd install
```

3. Gere o client do Prisma:

```powershell
npm.cmd run prisma:generate
```

4. Aplique a migration inicial no banco:

```powershell
npm.cmd run prisma:migrate:deploy
```

5. Rode o seed inicial:

```powershell
npm.cmd run prisma:seed
```

6. Rode em desenvolvimento:

```powershell
npm.cmd run start:dev
```

7. Swagger:

```text
http://localhost:3000/api/docs
```

## Regra de banco no scaffold atual

Se `.env` ainda nao existir ou `DATABASE_URL` nao estiver preenchida:

- `GET /health` continua respondendo;
- `auth/session/exchange` continua funcionando com `dev-token` em ambiente local;
- endpoints de dominio com Prisma respondem `503`.

Isso permite iniciar o front e o contrato da API antes do banco final estar fechado.

## Migration inicial

Ja foi gerada a migration inicial em:

```text
prisma/migrations/20260427_init/migration.sql
```

Ela foi derivada diretamente do schema atual com `Prisma Migrate Diff`, pronta para ser aplicada com:

```powershell
npm.cmd run prisma:migrate:deploy
```

## Bypass de autenticacao para desenvolvimento

Se `NODE_ENV` nao for `production`, o endpoint de exchange aceita o token `dev-token` quando:

- `DEV_AUTH_BYPASS=true`; ou
- o Firebase Admin ainda nao estiver configurado.

Isso existe apenas para viabilizar o front enquanto Firebase e banco ainda nao estiverem fechados.

Exemplo:

```http
POST /api/v1/auth/session/exchange
Content-Type: application/json

{
  "firebaseIdToken": "dev-token"
}
```

## Estrutura

```text
src/
  common/
  config/
  infra/
  modules/
prisma/
apache/
docs/
```

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
- com `SEED_ENABLE_SAMPLE_DATA=true`, o seed cria uma prestadora, um cliente e um contrato de exemplo;
- o seed e idempotente, entao pode ser executado novamente sem duplicar os registros base.
