# Preparacao do backend e integracao com o front atual

## 1. Objetivo deste documento

Este documento traduz o material base compartilhado para um plano tecnico do backend, mas agora considerando que o front ja existe e ja possui shell CRM, `People` em layout operacional e preview funcional de `Network`.

O foco daqui para frente e:

- manter o backend `API-first`;
- estabilizar o que ja esta em producao documental e em codigo;
- fechar lacunas reais para `People`, `Network`, sensivel e auditoria;
- impedir que a documentacao continue descrevendo um front que ainda sera construido.

## 2. Snapshot atual em `2026-05-02`

### 2.1 O que ja esta ativo no backend

- `POST /api/v1/auth/session/exchange`
- `GET /api/v1/auth/me`
- modulos de empresas prestadoras, clientes, contratos, pessoas e vinculos
- `tags-entidade` com `submissions`, `CRUD` e ACL
- `anexos` com `submissions`, `CRUD` e ACL
- envelope padrao de erro/sucesso com `traceId`

### 2.2 O que ja existe no front e impacta este backend

- shell CRM ativo
- modulo explicito de clientes
- `People` com `Employment Links`, bloco sensivel e anexos
- `Network` com quatro faixas, legenda, periodo, busca e painel lateral

### 2.3 O que continua aberto

- `refresh`, `logout` e `sensitive session` em runtime completo
- `GET /network/graph`
- ocorrencias
- auditoria
- relatorios
- storage/download protegido e step-up final para anexos

## 3. Decisoes de arquitetura

### 3.1 Stack recomendada e mantida

- `Node.js 22 LTS`
- `TypeScript`
- `NestJS` com `Fastify`
- `Prisma ORM`
- `MySQL 8.4`
- `Firebase Auth` para autenticacao primaria
- JWT interno para sessao curta
- `Apache` como reverse proxy
- `PM2` para processo Node
- `S3 privado` para anexos digitais

### 3.2 Regra principal

O backend continua sendo `API-first`.

Isso significa:

- contrato antes de ajuste visual;
- `publicId` como identificador exposto;
- ACL, sensibilidade e auditoria resolvidas no backend;
- o front respeita contrato e permissao, mas nao decide regra critica.

## 4. Relacao com o front atual

### 4.1 Leitura correta

O backend nao esta mais preparando um front futuro abstrato. Ele esta sustentando uma aplicacao Flutter que ja possui fluxo visual concreto.

Por isso, a regra agora e:

- preservar compatibilidade com o shell CRM atual;
- enriquecer payloads sem quebra silenciosa;
- tratar `People` e `Network` como modulos reais, nao como ideia de backlog.

### 4.2 `People` como dependencia real

O layout atual de `People` exige do backend:

- detalhe principal da pessoa;
- timeline de vinculos;
- historico multiempresa;
- tags sensiveis categorizadas;
- anexos com ACL;
- contexto suficiente para a coluna lateral e para a leitura de carreira.

Leitura operacional:

- pessoa e vinculo ja possuem base contratual para isso;
- o trabalho restante e de enriquecimento e integracao runtime, nao de criacao do modulo.

### 4.3 `Network` como dependencia contratual aberta

O front ja possui uma implementacao intermediaria de `Network`, com:

- quatro faixas (`Root Companies`, `Client Companies`, `Contracts`, `Employees`);
- legenda de relacao ativa, historica e indireta;
- filtro de periodo;
- busca;
- painel lateral de detalhe.

O backend ainda precisa fechar o contrato canonico:

- `GET /api/v1/network/graph`
- `nodes`
- `edges`
- `lanes`
- `filters`
- `legend`
- `detailSnapshot`

Este segue como principal bloqueador do modulo relacional final.

## 5. Padrao de contrato da API

### 5.1 Versionamento

Toda rota publica continua sob:

```text
/api/v1
```

### 5.2 Envelope padrao

Sucesso:

```json
{
  "data": {},
  "meta": {
    "traceId": "req_01..."
  }
}
```

Erro:

```json
{
  "error": {
    "code": "ACCESS_DENIED",
    "message": "Acesso negado para este recurso.",
    "details": [],
    "traceId": "req_01..."
  }
}
```

### 5.3 Regras tecnicas

- datas em `ISO 8601`
- `publicId` exposto ao front
- paginacao padrao com `page`, `perPage`, `total`, `totalPages`
- filtros por query string
- `traceId` em todas as respostas criticas

## 6. Fluxo de autenticacao e sessao

### 6.1 Ja ativo

- `POST /api/v1/auth/session/exchange`
- `GET /api/v1/auth/me`

### 6.2 Parcial ou reservado

- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/sensitive-session/start`
- `POST /api/v1/auth/sensitive-session/verify`

### 6.3 Fluxo esperado

```text
Front faz login no Firebase
  -> recebe Firebase ID Token
  -> chama POST /api/v1/auth/session/exchange
  -> backend valida token
  -> backend localiza ou cria usuario_sistema
  -> backend carrega perfis e permissoes
  -> backend emite access token interno
```

## 7. Modulos ativos do backend

| Area | Estado atual | Observacao |
| --- | --- | --- |
| Auth | ativo/parcial | sessao basica pronta; refresh e step-up ainda nao |
| Empresas prestadoras | ativo | base do modulo `Companies` |
| Clientes | ativo | base do modulo `Client Companies` |
| Contratos | ativo | base do modulo `Contracts` |
| Pessoas | ativo | base do layout novo de `People` |
| Vinculos | ativo | base da timeline de `Employment Links` |
| Tags sensiveis | ativo | ACL e `submissions` ja existem |
| Anexos | ativo | ACL e `submissions` ja existem |
| Teia relacional | ausente como endpoint canonico | principal bloqueador restante |
| Ocorrencias | ausente | modulo aberto |
| Auditoria | ausente como leitura operacional | modulo aberto |
| Relatorios | ausente | modulo aberto |

## 8. Regras de ACL para tags e anexos

As regras minimas continuam sendo:

- ACL por `ownerUserPublicId`, `allowedGroupKeys` e `allowedUserPublicIds`
- leitura autenticada
- submissao anonima apenas quando o fluxo exigir e sempre com ACL explicita
- nenhum vazamento de existencia, contagem, titulo ou resumo sem autorizacao valida

Classificacoes minimas:

Anexos:

- `formal_document`
- `sensitive_attachment`
- `supporting_reference`

Tags sensiveis:

- `behavioral_signal`
- `routine_context`
- `family_context`
- `training_or_skill`
- `personal_context`
- `operational_risk`

## 9. Infraestrutura alvo

A topologia recomendada continua:

```text
Usuario
  -> HTTPS
  -> Apache
  -> Node.js/NestJS em 127.0.0.1:3000
  -> RDS MySQL
  -> S3 privado
  -> Firebase Auth
```

Regras mantidas:

- `Apache` serve o front em `/`
- a API sai em `/api`
- `PM2` mantem o processo Node
- anexos sensiveis vao para storage privado

## 10. Roadmap tecnico real a partir de agora

### Fase 1. Sessao completa e compatibilidade de shell

- concluir `refresh`, `logout` e `sensitive session`
- estabilizar payload de sessao para o shell CRM

### Fase 2. Integracao real dos modulos ativos

- ligar front a empresas, clientes, contratos, pessoas e vinculos
- enriquecer detalhes apenas quando necessario

### Fase 3. `People` completo

- fechar payload lateral
- ligar tags e anexos reais
- sustentar ACL item a item

### Fase 4. `Network` contratual

- publicar `GET /network/graph`
- congelar entidades, relacoes e filtros
- permitir que o front abandone o payload de preview

### Fase 5. Dossie e seguranca forte

- ocorrencias
- auditoria
- storage/download protegido
- step-up final

### Fase 6. Relatorios e observabilidade

- relatorios operacionais
- historico de acesso
- eventos de seguranca e monitoracao

## 11. Decisao operacional

Se um documento desta pasta continuar dizendo que o front ainda sera construido, a leitura estara errada.

A verdade atual do projeto e:

- front e backend ja possuem base funcional concreta;
- a maior parte do trabalho restante agora e de integracao, refinamento e fechamento contratual;
- o maior bloqueador tecnico remanescente do layout novo e `GET /network/graph`.
