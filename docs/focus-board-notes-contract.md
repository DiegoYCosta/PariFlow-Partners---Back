# Focus Board Notes e Tasks - Contrato Backend Planejado

Data de referencia: `2026-07-12`.

Status: planejamento aprovado para modelagem. Este documento ainda nao declara
endpoint implementado. Ele passa a ser a referencia de desenho para substituir
a persistencia local do Focus Board por contrato backend com tenant, ACL e
auditoria.

## Motivo

O Focus Board atual do front possui notas, tarefas, filtros, atribuicoes,
visibilidade, lixeira, arquivamento e auditoria visual, mas as notas sao
persistidas em `shared_preferences`. Isso conflita com a UX alvo, que exige
organizacao pessoal e compartilhada com privacidade, rastreabilidade e tenant.

O novo contrato nao deve reciclar ocorrencias, tags, timeline ou agenda como
fonte primaria de notas. Esses dominios continuam existindo, mas uma nota do
Focus Board permanece informal/operacional ate que uma acao futura de conversao
crie explicitamente um registro formal.

## Regras obrigatorias

- O tenant vem sempre da sessao assinada pelo backend.
- O front nao envia `tenantRootCompanyId`, `tenantPublicId` ou equivalente.
- Toda referencia externa trafega por `publicId`; IDs internos nao cruzam a API.
- Nota privada nao aparece para outros usuarios, nem por titulo, resumo,
  contagem individual ou resultado de busca.
- Nota compartilhada so aparece para autoria, participantes ou audiencias
  explicitamente autorizadas.
- O Focus Board nao cria ocorrencia, timeline ou agenda automaticamente.
- Agenda pode refletir lembretes vinculados, mas nao vira armazenamento da nota.
- Anexos de nota exigem extensao de modelagem; nao usar `occurrenceId` falso.
- Chave omitida em `PATCH` preserva valor existente. `null` so limpa campos
  explicitamente anulaveis.
- Exclusao operacional e soft delete; apagamento fisico nao entra no fluxo
  normal.

## Limites do modelo atual

- `Attachment` hoje exige `occurrenceId`. Portanto nao existe anexo de nota
  seguro sem migracao de modelagem.
- `CalendarEntry` ja cobre agenda/lembretes, mas nao identifica fonte Focus
  Board de forma estruturada.
- `AuditLog` registra auditoria generica, mas nao possui payload de diff para a
  linha de auditoria exibida no detalhe da nota.
- `EntityTag` e `Occurrence` sao registros formais ou contextuais de entidade;
  usar qualquer um deles para salvar nota pessoal seria downgrade semantico.

## Modelo de dados proposto

### Enums

```prisma
enum FocusBoardNoteKind {
  NOTE
  TASK
}

enum FocusBoardNoteVisibility {
  PRIVATE
  SHARED
}

enum FocusBoardNoteStatus {
  ACTIVE
  COMPLETED
  ARCHIVED
  TRASHED
  DELETED
}

enum FocusBoardNotePriority {
  LOW
  NORMAL
  IMPORTANT
  URGENT
}

enum FocusBoardParticipantType {
  USER
  ACCESS_PROFILE
  SENSITIVE_AUDIENCE_GROUP
}

enum FocusBoardParticipantRole {
  OWNER
  EDITOR
  VIEWER
  ASSIGNEE
}

enum FocusBoardCompletionMode {
  OWNER_ONLY
  FIRST_COMPLETES_ALL
  ALL_MUST_COMPLETE
}

enum FocusBoardContextType {
  PERSON
  PROVIDER_COMPANY
  CLIENT_COMPANY
  CONTRACT
  EMPLOYMENT_LINK
  POSITION
  TIMELINE_RECORD
  CALENDAR_ENTRY
  OTHER
}

enum FocusBoardNoteEventType {
  CREATED
  UPDATED
  STATUS_CHANGED
  PARTICIPANT_ADDED
  PARTICIPANT_REMOVED
  COMPLETED
  REOPENED
  ARCHIVED
  TRASHED
  RESTORED
  DELETED
  REMINDER_LINKED
  ATTACHMENT_LINKED
}
```

### `focus_board_note`

Registro principal da nota/tarefa. O texto informal vive aqui, separado do
historico formal da pessoa.

Campos principais:

- `id`, `publicId`
- `tenantRootCompanyId`
- `parentNoteId`, `threadRootNoteId`
- `kind`
- `title`
- `body`
- `status`
- `priority`
- `visibility`
- `completionMode`
- `dueAt`
- `completedAt`
- `archivedAt`
- `trashedAt`
- `deletedAt`
- `createdByUserSystemId`
- `ownerUserSystemId`
- `updatedByUserSystemId`
- `lastEditJustification`
- `version`
- `createdAt`, `updatedAt`

Indices minimos:

- `[tenantRootCompanyId, ownerUserSystemId, status, updatedAt]`
- `[tenantRootCompanyId, status, dueAt]`
- `[tenantRootCompanyId, visibility, updatedAt]`
- `[threadRootNoteId, createdAt]`
- `[parentNoteId, createdAt]`

### `focus_board_note_participant`

Define audiencia, permissao de edicao e responsabilidade de conclusao.

Campos principais:

- `id`, `publicId`
- `noteId`
- `participantType`
- `userSystemId`
- `accessProfileId`
- `audienceGroupKey`
- `role`
- `canComplete`
- `completedAt`
- `completedByUserSystemId`
- `createdByUserSystemId`
- `createdAt`, `updatedAt`

Regras:

- `OWNER` deve existir para `ownerUserSystemId`.
- `USER` usa FK para `UserSystem`.
- `ACCESS_PROFILE` usa FK para `AccessProfile`.
- `SENSITIVE_AUDIENCE_GROUP` usa enum `SensitiveAudienceGroup`.
- `completedAt` por participante so vale quando `role = ASSIGNEE` ou
  `canComplete = true`.
- Unicidade por nota e alvo: usuario, perfil ou grupo.

### `focus_board_note_context`

Relaciona a nota a entidades operacionais sem transformar a entidade em dona da
nota.

Campos principais:

- `id`, `publicId`
- `noteId`
- `contextType`
- `personId`
- `providerCompanyId`
- `clientCompanyId`
- `contractId`
- `employmentLinkId`
- `positionId`
- `timelineRecordId`
- `calendarEntryId`
- `externalLabel`
- `labelSnapshot`
- `createdAt`

Regras:

- O service resolve `publicId` para FK interna e valida tenant antes de gravar.
- `OTHER` exige `externalLabel` e nao permite inferir acesso a entidade real.
- Contexto nao concede acesso automaticamente; acesso vem de participantes e
  autoria.
- Quando uma ficha de Pessoa exibir notas relacionadas, a busca filtra por
  `personId` e ainda aplica ACL da nota.

### `focus_board_note_event`

Linha de auditoria de produto para o detalhe da nota.

Campos principais:

- `id`, `publicId`
- `tenantRootCompanyId`
- `noteId`
- `actorUserSystemId`
- `eventType`
- `summary`
- `beforeJson`
- `afterJson`
- `ipAddress`
- `device`
- `createdAt`

Regra: mutacoes tambem devem gravar `AuditLog` com
`entityName = 'focus_board_note'`, para relatorios e auditoria transversal.

### Lembretes de agenda

Nao adicionar campos de origem livre em `agenda_item`. A relacao deve ser
explicita:

`focus_board_note_reminder`

- `id`, `publicId`
- `noteId`
- `calendarEntryId`
- `createdByUserSystemId`
- `createdAt`

Regras:

- Criar lembrete chama o service de Agenda ou reutiliza sua validacao de
  calendario.
- Cancelar o lembrete cancela o `agenda_item`, nao apaga a nota.
- A Agenda exibe o item como agenda; o Focus Board exibe o vinculo como
  lembrete da nota.

### Anexos de nota

Primeira implementacao segura recomendada:

1. Generalizar `Attachment` para aceitar dono por nota sem usar ocorrencia
   falsa.
2. Tornar `occurrenceId` opcional somente junto da introducao de
   `focusBoardNoteId`.
3. Garantir no service a regra "exatamente um dono": ocorrencia ou nota.
4. Criar indices `[tenantRootCompanyId, focusBoardNoteId, status]`.
5. Reutilizar `AttachmentAudienceGroup`, `AttachmentAudienceUser`, step-up e URL
   assinada.

Se essa migracao for considerada grande para a primeira entrega, anexos diretos
de nota devem ficar bloqueados no backend e no front. O front pode apenas abrir
anexos existentes de ocorrencias autorizadas por link contextual, sem copiar ou
vincular silenciosamente.

## Contrato HTTP proposto

Base: `/api/v1/focus-board/notes`

Todas as respostas seguem envelope `{ data, meta }` e erros seguem
`{ error: { code, message, traceId } }`.

### Listar notas

`GET /api/v1/focus-board/notes`

Query:

- `status=ACTIVE|COMPLETED|ARCHIVED|TRASHED`
- `kind=NOTE|TASK`
- `visibility=PRIVATE|SHARED`
- `priority=LOW|NORMAL|IMPORTANT|URGENT`
- `contextType=PERSON|PROVIDER_COMPANY|CLIENT_COMPANY|CONTRACT|EMPLOYMENT_LINK|POSITION|TIMELINE_RECORD|CALENDAR_ENTRY|OTHER`
- `contextPublicId=...`
- `dueFrom=YYYY-MM-DD`
- `dueTo=YYYY-MM-DD`
- `updatedAfter=ISO`
- `search=...`
- `limit=1..100`
- `cursor=opaque`

Resposta:

```json
{
  "data": {
    "items": [],
    "nextCursor": null
  },
  "meta": {
    "authorizedTotal": 0
  }
}
```

`authorizedTotal` conta somente notas visiveis ao usuario autenticado. Nao ha
contagem de itens bloqueados.

### Criar nota/tarefa

`POST /api/v1/focus-board/notes`

Body:

```json
{
  "kind": "TASK",
  "title": "Revisar documentos para cliente X",
  "body": "Conferir ASO e contrato antes da reuniao.",
  "priority": "IMPORTANT",
  "visibility": "PRIVATE",
  "completionMode": "OWNER_ONLY",
  "dueAt": "2026-07-15T12:00:00-03:00",
  "contexts": [
    {
      "contextType": "PERSON",
      "contextPublicId": "pes_..."
    }
  ],
  "participants": [
    {
      "participantType": "USER",
      "userPublicId": "usr_...",
      "role": "OWNER",
      "canComplete": true
    }
  ],
  "parentNotePublicId": null
}
```

Regras:

- `visibility=PRIVATE` ignora participantes nao proprietarios, exceto usuarios
  explicitamente informados com `USER`.
- `visibility=SHARED` exige ao menos um participante alem do owner ou um
  contexto de audiencia configurado.
- `parentNotePublicId` cria resposta dentro da thread da nota; nao cria
  ocorrencia nem timeline.

### Obter detalhe

`GET /api/v1/focus-board/notes/:publicId`

Retorna nota, contextos, participantes autorizados, lembretes e flags de acao.
Sem permissao retorna `404` ou `403` sem titulo/resumo, conforme padrao global
definido no filtro HTTP.

### Atualizar nota

`PATCH /api/v1/focus-board/notes/:publicId`

Campos aceitos:

- `title`
- `body`
- `priority`
- `visibility`
- `completionMode`
- `dueAt`
- `contexts`
- `participants`
- `editJustification`

Regras:

- Campo omitido preserva.
- `dueAt: null` remove prazo.
- `contexts` e `participants`, quando enviados, substituem suas listas apos
  validacao atomica.
- Mudanca de visibilidade de `PRIVATE` para `SHARED` grava evento especifico.
- Mudanca de `SHARED` para `PRIVATE` remove participantes nao permitidos.

### Transicoes de status

- `POST /api/v1/focus-board/notes/:publicId/complete`
- `POST /api/v1/focus-board/notes/:publicId/reopen`
- `POST /api/v1/focus-board/notes/:publicId/archive`
- `POST /api/v1/focus-board/notes/:publicId/trash`
- `POST /api/v1/focus-board/notes/:publicId/restore`
- `DELETE /api/v1/focus-board/notes/:publicId`

`DELETE` marca `DELETED` e exige permissao de owner/editor ou contexto
privilegiado definido depois. Nao remove fisicamente por padrao.

### Lembretes

- `POST /api/v1/focus-board/notes/:publicId/reminders`
- `DELETE /api/v1/focus-board/notes/:publicId/reminders/:reminderPublicId`

Criar lembrete recebe os mesmos campos basicos de `CreateCalendarEntryDto`, mas
o backend fixa categoria/fonte Focus Board e cria a relacao em
`focus_board_note_reminder`.

### Auditoria

`GET /api/v1/focus-board/notes/:publicId/events`

Lista eventos visiveis ao usuario autorizado. Usuario sem permissao na nota nao
recebe nem contagem.

## ACL

Leitura autorizada quando:

- ator e owner da nota;
- ator e participante `USER`;
- ator possui perfil listado como participante `ACCESS_PROFILE`;
- ator possui grupo listado como participante `SENSITIVE_AUDIENCE_GROUP`;
- ator e participante por regra futura explicitamente documentada.

Edicao autorizada quando:

- ator e owner;
- ator e participante com `role=EDITOR`;
- regra futura de administracao for criada com capability dedicada.

Conclusao autorizada quando:

- ator e owner e `completionMode=OWNER_ONLY`;
- ator e participante com `canComplete=true`;
- `FIRST_COMPLETES_ALL` marca a nota completa no primeiro participante
  autorizado;
- `ALL_MUST_COMPLETE` exige todos os participantes obrigatorios.

Nenhuma regra de contexto concede leitura por si so. Estar vinculado a uma
pessoa, contrato ou empresa nao torna a nota publica para todos que veem aquela
entidade.

## Integracoes

### Home

Home pode exibir ate cinco notas/tarefas autorizadas para retomar, usando:

`GET /api/v1/focus-board/notes?status=ACTIVE&limit=5`

O item deve abrir o Focus Board ou a nota. Sem permissao, o item simplesmente
nao aparece.

### Pessoas

Pessoas pode pedir notas relacionadas:

`GET /api/v1/focus-board/notes?contextType=PERSON&contextPublicId=pes_...`

Somente notas autorizadas entram na resposta. Notas privadas de terceiros nao
aparecem nem como contagem.

### Timeline/Agenda

Agenda continua origem canonica de compromissos. O Focus Board pode criar um
lembrete vinculado por `focus_board_note_reminder`, mas editar a nota nao muda
automaticamente a agenda sem acao explicita.

### Network

Network nao deve criar ou editar notas. Em fase futura, pode exibir indicacao
autorizada de contexto operacional, sem revelar conteudo privado.

## Migracao do front atual

Notas locais em `shared_preferences` nao devem ser enviadas automaticamente ao
backend.

Plano seguro:

1. Backend novo entra com endpoints protegidos.
2. Front adiciona adapter API sem remover imediatamente a leitura local.
3. Usuario autenticado recebe acao explicita "Migrar notas locais".
4. Cada nota local ganha `clientMigrationId` idempotente.
5. Backend rejeita duplicidade por `[tenantRootCompanyId, ownerUserSystemId,
   clientMigrationId]`.
6. Apos sucesso, front marca a nota local como migrada e passa a renderizar a
   versao backend.
7. Falha parcial preserva o dado local e mostra erro recuperavel.

## Fases de implementacao

### Fase 1 - Backend sem anexos diretos

- Prisma: notas, participantes, contextos, eventos e lembretes.
- Modulo Nest `focus-board`.
- Endpoints CRUD, status, eventos e lembretes.
- Testes de tenant, ACL, omissao em PATCH, auditoria e idempotencia de migracao.
- Front ainda pode manter local como fonte ate adapter ficar pronto.

### Fase 2 - Front API

- Adapter para `/focus-board/notes`.
- Estados loading/empty/error/sem permissao.
- Migracao manual das notas locais.
- Remocao de `shared_preferences` como fonte primaria apos validacao.

### Fase 3 - Anexos diretos

- Generalizar dono de `Attachment` ou criar camada generica de arquivo protegido.
- Reusar step-up, signed URL e auditoria.
- Nunca anexar nota criando ocorrencia falsa.

### Fase 4 - Conversoes futuras

- Converter nota em ocorrencia.
- Converter nota em evento de timeline ou agenda.
- Criar vinculo bidirecional e idempotente.
- Preservar nota original e auditoria de ambos os dominios.

## Criterios de aceite do contrato

- Nota privada de um usuario nao aparece para outro usuario do mesmo tenant.
- Busca/listagem nao revela titulo, resumo ou contagem de notas bloqueadas.
- Usuario de outro tenant nao acessa nota mesmo sabendo `publicId`.
- `PATCH` com chave omitida preserva valor.
- `DELETE` e transicoes gravam soft state e auditoria.
- Contexto de pessoa/contrato/empresa nao concede ACL automaticamente.
- Lembrete criado a partir da nota aparece na Agenda sem transformar a nota em
  agenda.
- Falha de API no front nao volta para mock nem para local silencioso.
- Migracao local exige acao explicita e e idempotente.
