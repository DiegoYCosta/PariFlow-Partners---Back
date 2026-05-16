# Network Timeline Read Model

Data de referencia: `2026-05-16`.

Este documento e a fonte de planejamento para evoluir a Network do grafo
relacional atual para uma timeline horizontal multicamadas. A implementacao
deve ser aditiva, preservar o contrato vigente de `GET /api/v1/network/graph`
e nao usar estruturas legadas como autoridade quando elas reduzirem a fidelidade
temporal.

## Regras obrigatorias

- Nao fazer downgrade de modelagem para simplificar UI ou query.
- Nao reciclar `nodes` e `edges` como contrato principal da timeline.
- Nao remover, renomear ou quebrar `GET /api/v1/network/graph`.
- Nao alterar `.env`, `.env.example`, secrets, deploy AWS ou configuracao de
  S3 sem necessidade documentada.
- Chave omitida em payload de update deve preservar dado existente.
- Toda referencia consumida pelo front usa `publicId`; `id` interno de banco
  nao entra em contrato de UI.
- Toda consulta deve respeitar `tenantWhere` ou escopo equivalente por empresa
  raiz.
- Se o codigo atual divergir deste documento, parar e registrar o conflito antes
  de implementar.

## Decisao arquitetural

Criar um novo read model:

```text
GET /api/v1/network/timeline
```

O endpoint atual de grafo continua como fonte do mapa relacional:

```text
GET /api/v1/network/graph
```

A timeline nao deve ser montada no front a partir do grafo. O backend precisa
entregar segmentos temporais, eventos e snapshot atual ja normalizados para
renderizacao.

## Compatibilidade

| Area | Regra |
| --- | --- |
| Front atual | Continua usando `/network/graph` ate a tela de timeline estar pronta |
| Backend | Novo endpoint e novo DTO sem alterar DTO do grafo atual |
| Banco | Migracoes apenas aditivas; nenhuma coluna historica deve ser removida |
| AWS | Mesma rota `/api/v1`; sem nova porta, worker ou bucket no primeiro ciclo |
| Amazon S3 | Sem impacto previsto; anexos continuam no modulo atual |
| Ambiente | Nenhuma nova chave obrigatoria de `.env` no primeiro ciclo |
| Response envelope | Manter envelope global `{ data, meta }` |

### Matriz detalhada de compatibilidade

| Superficie | Antes | Durante a implementacao | Depois do primeiro ciclo |
| --- | --- | --- | --- |
| `/network/graph` | Fonte vigente do grafo | Intocado e coberto por smoke | Continua disponivel |
| `/network/timeline` | Inexistente | Novo endpoint aditivo | Fonte da timeline e do modo atual |
| DTO do grafo | `NetworkGraphQueryDto` | Sem mudanca obrigatoria | Sem mudanca obrigatoria |
| DTO da timeline | Inexistente | `NetworkTimelineQueryDto` separado | Evolui aditivamente |
| Banco | Schema atual | Sem migracao obrigatoria no ciclo 1 | Migracao aditiva opcional no ciclo 2 |
| `EmploymentMove` | Origem/destino textuais | Evento narrativo + warning | Pode ganhar referencias estruturadas opcionais |
| `.env` | Chaves atuais | Nenhuma chave nova obrigatoria | Nenhuma chave nova sem documento de operacao |
| AWS/Apache/PM2 | `/api/v1` atual | Sem nova porta ou worker | Mesmo caminho de deploy |
| S3/anexos | Modulo de anexos atual | Sem impacto | Sem impacto previsto |
| Swagger | Endpoints atuais | Documenta endpoint novo | Ajuda smoke e integracao |
| Front atual | Consome grafo | Continua consumindo grafo | Pode alternar timeline/atual/relacional |

## Contrato do endpoint

```text
GET /api/v1/network/timeline
```

Query suportada:

- `periodPreset=6m|1y|2y|5y|all`
- `from=YYYY-MM-DD`, opcional; quando enviado prevalece sobre preset
- `to=YYYY-MM-DD`, opcional; default data atual
- `focusCompanyPublicId`, opcional
- `focusCompanyType=provider_company|client_company`, opcional
- `rootCompanyPublicIds`, CSV ou lista repetida
- `clientCompanyPublicIds`, CSV ou lista repetida
- `contractStatuses`, CSV ou lista repetida, normalizado em lowercase
- `employeeStatuses`, CSV ou lista repetida, normalizado em lowercase
- `includeHistorical`, default `true`
- `includeMoves`, default `true`
- `includeOperationalEvents`, default `true`
- `search`, opcional

Campos desconhecidos devem ser ignorados ou rejeitados com erro claro de
validacao, conforme padrao dos DTOs existentes. Nao aceitar parametros que
alterem tenant ou exponham dados fora da empresa raiz.

## Payload

O retorno e envelopado pelo interceptor global.

Fixture oficial do contrato:

```text
docs/network-timeline-payload-example.json
```

A fixture cobre contrato ativo, contrato encerrado, posto, colaborador ativo,
colaborador desligado, evento manual e movimentacao textual sem ids estruturados
com warning. Ela e documental; runtime real nunca deve usar fixture como
fallback.

```json
{
  "data": {
    "period": {
      "preset": "1y",
      "from": "2025-05-16",
      "to": "2026-05-16"
    },
    "focus": {
      "companyPublicId": "emp_...",
      "companyType": "provider_company",
      "displayName": "PariFlow Services"
    },
    "layers": {
      "contracts": [],
      "collaborators": [],
      "events": []
    },
    "currentSnapshot": {
      "contracts": [],
      "positions": [],
      "collaborators": []
    },
    "filters": {
      "search": "",
      "applied": {},
      "available": {}
    },
    "legend": {
      "eventTypes": [],
      "relationshipStates": []
    },
    "warnings": []
  },
  "meta": {
    "traceId": "req_..."
  }
}
```

### Contract segment

```json
{
  "publicId": "ctr_...",
  "providerCompanyPublicId": "emp_...",
  "providerCompanyName": "Prestadora",
  "clientCompanyPublicId": "cli_...",
  "clientCompanyName": "Cliente",
  "displayName": "Prestadora -> Cliente",
  "startsAt": "2025-01-01",
  "endsAt": null,
  "status": "active",
  "positions": []
}
```

### Position segment

```json
{
  "publicId": "pos_...",
  "contractPublicId": "ctr_...",
  "displayName": "Portaria 12x36",
  "serviceName": "Portaria",
  "location": "Unidade Campinas",
  "shift": "Noturno",
  "schedule": "12x36",
  "status": "active",
  "startsAt": "2025-01-01",
  "endsAt": null,
  "allocations": []
}
```

`Position` ainda nao possui datas proprias no schema atual. No primeiro ciclo,
`startsAt` e `endsAt` da posicao devem derivar do contrato e precisam carregar
`dateSource: "contract"` caso esse metadado seja exposto. Nao inventar datas
de posto no backend.

### Allocation segment

```json
{
  "employmentLinkPublicId": "vin_...",
  "personPublicId": "pes_...",
  "personName": "Mariana Silva",
  "providerCompanyPublicId": "emp_...",
  "contractPublicId": "ctr_...",
  "positionPublicId": "pos_...",
  "startsAt": "2025-02-01",
  "endsAt": null,
  "status": "active",
  "type": "CLT"
}
```

### Collaborator history

```json
{
  "personPublicId": "pes_...",
  "personName": "Mariana Silva",
  "status": "active",
  "segments": [
    {
      "kind": "allocation",
      "employmentLinkPublicId": "vin_...",
      "contractPublicId": "ctr_...",
      "positionPublicId": "pos_...",
      "startsAt": "2025-02-01",
      "endsAt": null,
      "status": "active"
    }
  ],
  "events": []
}
```

### Event

```json
{
  "publicId": "mov_...",
  "eventType": "move",
  "source": "employment_move",
  "occurredAt": "2025-06-01",
  "personPublicId": "pes_...",
  "employmentLinkPublicId": "vin_...",
  "originPositionPublicId": "pos_...",
  "destinationPositionPublicId": "pos_...",
  "label": "Movimentacao",
  "notes": null
}
```

Tipos iniciais:

- `admission`
- `allocation`
- `move`
- `dismissal`
- `timeline_record`
- `calendar_entry`

### Warning

```json
{
  "code": "employment_move_unstructured",
  "severity": "warning",
  "entityPublicId": "mov_...",
  "message": "Movimentacao possui origem/destino textual sem referencia estruturada para posto."
}
```

Warnings nao invalidam o payload. Eles existem para impedir que o front
improvise relacoes visuais quando a modelagem ainda nao permite uma conexao
segura.

## Conflito tecnico identificado

O schema atual de `EmploymentMove` possui `origin` e `destination` como texto,
sem referencias estruturadas para posto ou contrato. Esse modelo e suficiente
para historico narrativo, mas nao e autoridade suficiente para desenhar
transferencia precisa entre postos.

Regra de seguranca:

- Nao inferir `originPositionPublicId` ou `destinationPositionPublicId` por
  comparacao de texto.
- Nao desenhar linha de transferencia entre postos sem referencia estruturada.
- Antes de representar movimentos entre camadas como relacao de negocio,
  executar migracao aditiva para guardar as referencias estruturadas.

Migracao aditiva sugerida:

```text
EmploymentMove
- originPositionId BigInt?
- destinationPositionId BigInt?
- originContractId BigInt?
- destinationContractId BigInt?
```

Esses campos devem ser opcionais para preservar dados existentes. Registros
antigos continuam validos, mas eventos sem referencia estruturada devem sair com
warning ou sem conexao posicional.

## Implementacao backend

1. Criar `NetworkTimelineQueryDto`.
2. Adicionar `timeline(query, actor)` em `NetworkService`.
3. Adicionar `GET /timeline` em `NetworkController`.
4. Criar includes Prisma especificos para timeline, separados do include do
   grafo.
5. Reaproveitar `resolvePeriod`, normalizacao de status e filtros quando isso
   nao empobrecer o contrato.
6. Montar contratos, postos, alocacoes, historico de colaboradores e eventos.
7. Adicionar warnings para dados incompletos, sem quebrar o payload.
8. Manter limite inicial documentado e defensivo, com plano para paginacao ou
   agrupamento quando houver volume real.

## Checklist por PR

### PR 1 - Contrato e fixture

- Adicionar/atualizar este documento e a fixture oficial.
- Confirmar que o contrato nao altera `/network/graph`.
- Validar JSON da fixture.
- Nao alterar codigo runtime.

### PR 2 - DTO, controller e service vazio seguro

- Criar `NetworkTimelineQueryDto`.
- Adicionar rota `GET /network/timeline`.
- Retornar payload vazio valido com filtros, legenda e periodo.
- Cobrir build/lint e smoke do grafo atual.

### PR 3 - Read model de contratos, postos e alocacoes

- Implementar includes Prisma especificos da timeline.
- Montar contratos, postos e alocacoes.
- Respeitar tenant e filtros.
- Testar payload vazio, filtros e status.

### PR 4 - Eventos e warnings

- Emitir `admission`, `dismissal`, `timeline_record` e `calendar_entry`.
- Emitir `move` como evento narrativo quando so houver texto.
- Gerar warning para movimento sem ids estruturados.
- Nao desenhar nem prometer conexao posicional sem ids.

### PR 5 - Migracao aditiva de movimentos estruturados

- Adicionar campos opcionais em `EmploymentMove`.
- Preservar `origin` e `destination`.
- Atualizar criacao futura de movimento para preencher ids quando disponiveis.
- Sem backfill inseguro.

### PR 6 - Hardening e volume

- Revisar limites, ordenacao e indices.
- Validar `prisma:migrate:status`.
- Testar tenant isolation com usuario real.
- Registrar qualquer necessidade de infra antes de alterar AWS.

## Banco e migracoes

Primeiro ciclo sem migracao obrigatoria:

- endpoint timeline pode representar contratos, postos por contrato, alocacoes,
  admissoes e desligamentos usando dados atuais.
- movimentos entram como eventos narrativos quando so houver `origin` e
  `destination` textuais.

Segundo ciclo com migracao aditiva:

- adicionar referencias estruturadas em `EmploymentMove`;
- preencher campos novos nos fluxos futuros de movimentacao;
- criar backfill somente quando houver regra segura e auditavel;
- nunca apagar `origin` e `destination`, pois eles preservam historico textual.

## AWS e operacao

- Nenhuma nova variavel obrigatoria no `.env`.
- Nenhuma alteracao no Apache, PM2, CORS ou dominio no primeiro ciclo.
- Swagger deve expor o novo endpoint quando `SWAGGER_ENABLED=true`.
- O deploy AWS segue os scripts existentes.
- Se o endpoint exigir limite maior de memoria ou timeout, parar e documentar
  antes de alterar infra.

## Testes obrigatorios

Backend:

- `npm run lint`
- `npm run build`
- `npm run prisma:format`
- `npm run prisma:migrate:status`

Casos unitarios ou de service a criar junto da implementacao:

- periodo `6m`, `1y`, `2y`, `5y`, `all`;
- `from/to` explicitos;
- contrato ativo, encerrado e suspenso;
- vinculo ativo, desligado, suspenso e pendente;
- desligamento com `Dismissal`;
- movimento textual sem ids estruturados gera evento sem conexao posicional;
- movimento estruturado gera conexao posicional;
- filtro por prestadora, cliente, status, historico e busca;
- tenant isolation com usuario real;
- payload vazio com filtros/legenda preservados.

Smoke manual:

- `GET /api/v1/network/graph` continua retornando o payload anterior.
- `GET /api/v1/network/timeline` retorna `{ data, meta }`.
- Front antigo continua funcional mesmo sem consumir timeline.

## Criterios de aceite

- Sem regressao no grafo atual.
- Sem uso de mock ou sample como fallback de runtime.
- Sem exposicao de `id` interno.
- Sem alteracao de `.env` para facilitar teste.
- Sem inferencia textual de movimentacao como relacao de negocio.
- Contrato timeline documentado antes do front consumir.
- Warnings explicitos quando dado historico nao tiver estrutura suficiente.
