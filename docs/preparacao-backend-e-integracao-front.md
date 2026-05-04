# Preparacao do Backend e Integracao com o Front

Data de referencia: `2026-05-04`.

## Objetivo

Registrar o plano tecnico vivo para o backend sustentar o front Flutter atual e
o deploy AWS. Este documento substitui a leitura antiga que tratava Network,
Ocorrencias e CRUDs mestre como ausentes.

## Estado Atual

| Area | Estado |
| --- | --- |
| Auth basico | ativo |
| Companies/Clients/Contracts | CRUD ativo |
| Catalogo contratual | tipos, modelos, servicos, postos e documentos ativos |
| People | pessoas, vinculos, ocorrencias, tags e anexos ativos |
| Network | `GET /api/v1/network/graph` ativo |
| AWS | homologacao por IP ativa com Apache, PM2 e MySQL local |
| Firebase runtime | Web inicializado no front; login por e-mail/senha ativo |
| Refresh/logout/step-up | parcial/reservado |
| Storage/download protegido | pendente |
| Auditoria/relatorios | pendente |

## Decisoes Mantidas

- Backend continua `API-first`.
- Front usa `publicId`, nunca ID interno.
- ACL, permissao e conteudo sensivel sao decididos no backend.
- Service Account Firebase, JWT secrets, senha de banco e chaves AWS ficam
  somente em `.env`/infra do backend, nunca no front.
- O script `scripts/apply-firebase-admin-env.ps1` importa Service Account para
  `.env` sem exibir private key.
- O script `npm run user:grant-admin -- --email ... --firebaseUid ...` garante
  perfil ADMIN para usuarios reais do Firebase.
- Apache deve expor apenas `/`, `/api` e `/health`.
- MySQL deve ficar em `127.0.0.1`.
- `.env` real nao entra no Git.

## Integracao com Front Atual

O front ja consome a API real para:

- Companies, Clients e Contracts;
- catalogo contratual;
- People;
- ocorrencias;
- anexos;
- Network.

Durante preview privado, o front inicializa Firebase Web, exibe login por
e-mail/senha e usa token Firebase real quando houver usuario logado. Enquanto
usuarios reais e Admin SDK nao estiverem fechados, ele ainda pode trocar sessao
com `dev-token` se o build permitir `PARIFLOW_ENABLE_DEV_TOKEN=true`.
Portanto, homologacao por IP usa `PREVIEW_AUTH_BYPASS=true`. Producao publica
exige Firebase Admin configurado, build com `PARIFLOW_ENABLE_DEV_TOKEN=false`
e bypass desligado.

## Roadmap Real

### Fase 1. Homologacao AWS

Concluida em preview por IP. Apache serve o Flutter estatico em `/`, encaminha
`/api` e `/health` para o backend, PM2 mantem a API e MySQL escuta em
`127.0.0.1`.

### Fase 2. Validacao com Dados Reais

- validar CRUDs mestre;
- validar contratos, tipos, modelos, servicos, postos e documentos;
- validar People com vinculos, ocorrencias e anexos;
- validar Network real com filtros e periodo.

### Fase 3. Auth de Producao

- habilitar Email/Password e criar usuarios reais no Firebase;
- preencher Firebase Admin no `.env` da EC2;
- buildar o front com `PARIFLOW_ENABLE_DEV_TOKEN=false`;
- desligar `PREVIEW_AUTH_BYPASS`;
- implementar refresh/logout.

### Fase 4. Dossie Seguro

- storage privado;
- download rastreavel;
- sensitive-session/step-up;
- auditoria de acesso e eventos de seguranca.

### Fase 5. Inteligencia Operacional

- relatorios;
- consultas executivas;
- observabilidade;
- otimizacao de Network e payloads agregados.

## Criterios de Pronto Para Online

- lint/build do back passam;
- build web do front passa;
- migrations aplicadas na EC2;
- `/health/ready` retorna `200`;
- rotas protegidas recusam requisicao sem Bearer;
- Security Group nao expoe `3000`, `3001`, `3306` ou `33060`;
- MySQL escuta em `127.0.0.1`;
- smoke test passa em preview;
- antes de producao publica, `dev-token` deve falhar.
