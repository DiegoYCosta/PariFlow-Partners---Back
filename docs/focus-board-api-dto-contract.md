# Focus Board - Contrato de API e DTOs

Data de referencia: `2026-07-12`.

Status: especificacao de DTOs planejados. Nao declara endpoint implementado.

Base: `/api/v1/focus-board/notes`.

## Envelope

Sucesso:

```json
{ "data": {}, "meta": {} }
```

Erro:

```json
{ "error": { "code": "FOCUS_BOARD_NOTE_NOT_FOUND", "message": "Nota nao encontrada.", "traceId": "req_..." } }
```

## DTOs comuns

### FocusBoardNoteContextDto

```json
{
  "contextType": "PERSON",
  "contextPublicId": "pes_...",
  "externalLabel": null
}
```

Regras:

- `contextType` obrigatorio.
- `contextPublicId` obrigatorio exceto `OTHER`.
- `externalLabel` obrigatorio para `OTHER`.
- Backend resolve entidade e valida tenant.

### FocusBoardNoteParticipantDto

```json
{
  "participantType": "USER",
  "userPublicId": "usr_...",
  "accessProfilePublicId": null,
  "audienceGroupKey": null,
  "role": "VIEWER",
  "canComplete": false,
  "requiredForCompletion": false
}
```

Regras:

- Exatamente um alvo deve ser informado.
- `OWNER` e gerado/validado pelo backend para o owner.
- Participante por perfil/grupo nao deve ser aceito em nota `PRIVATE`, salvo
  decisao futura documentada.

## CreateFocusBoardNoteDto

```json
{
  "kind": "TASK",
  "title": "Revisar documentos",
  "body": "Conferir ASO antes da reuniao.",
  "priority": "IMPORTANT",
  "visibility": "PRIVATE",
  "completionMode": "OWNER_ONLY",
  "dueAt": "2026-07-15T12:00:00-03:00",
  "parentNotePublicId": null,
  "clientMigrationId": null,
  "contexts": [],
  "participants": []
}
```

Validacoes:

- `kind`: `NOTE|TASK`, default `NOTE`.
- `title`: 1 a 180 chars.
- `body`: ate 4000 chars.
- `priority`: `LOW|NORMAL|IMPORTANT|URGENT`, default `NORMAL`.
- `visibility`: `PRIVATE|SHARED`, default `PRIVATE`.
- `completionMode`: default `OWNER_ONLY`.
- `dueAt`: ISO opcional.
- `parentNotePublicId`: publicId de nota visivel no mesmo tenant.
- `clientMigrationId`: ate 80 chars, opcional.
- `contexts`: maximo 20.
- `participants`: maximo 50.

## UpdateFocusBoardNoteDto

Todos os campos sao opcionais:

```json
{
  "title": "Revisar documentos atualizados",
  "body": "Novo texto",
  "priority": "URGENT",
  "visibility": "SHARED",
  "completionMode": "ALL_MUST_COMPLETE",
  "dueAt": null,
  "contexts": [],
  "participants": [],
  "editJustification": "Ajuste solicitado pelo DP.",
  "expectedVersion": 3
}
```

Regras:

- Chave omitida preserva valor.
- `dueAt: null` limpa prazo.
- `body: null` limpa corpo.
- `contexts`, quando enviado, substitui lista inteira.
- `participants`, quando enviado, substitui lista inteira mantendo owner.
- `expectedVersion` opcional; se divergente, retornar `409`.

## ListFocusBoardNotesQueryDto

Query params:

- `status`
- `kind`
- `visibility`
- `priority`
- `contextType`
- `contextPublicId`
- `dueFrom`
- `dueTo`
- `updatedAfter`
- `search`
- `limit`
- `cursor`

Limites:

- `limit`: 1 a 100, default 30.
- `search`: 2 a 80 chars.
- `cursor`: opaco para o front.

## Resposta de lista

```json
{
  "data": {
    "items": [
      {
        "publicId": "fcn_...",
        "kind": "TASK",
        "title": "Revisar documentos",
        "bodyPreview": "Conferir ASO...",
        "status": "ACTIVE",
        "priority": "IMPORTANT",
        "visibility": "PRIVATE",
        "dueAt": "2026-07-15T12:00:00-03:00",
        "contexts": [],
        "participantsSummary": {
          "authorizedCount": 1,
          "completedCount": 0
        },
        "permissions": {
          "canRead": true,
          "canEdit": true,
          "canComplete": true,
          "canArchive": true,
          "canTrash": true
        },
        "createdAt": "2026-07-12T10:00:00-03:00",
        "updatedAt": "2026-07-12T10:00:00-03:00",
        "version": 1
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "authorizedTotal": 1
  }
}
```

## Resposta de detalhe

Detalhe inclui `body`, participantes autorizados, contextos, reminders,
eventsSummary e permissions. Usuario sem permissao nao recebe detalhe parcial.

## Transicoes

Endpoints:

- `POST /:publicId/complete`
- `POST /:publicId/reopen`
- `POST /:publicId/archive`
- `POST /:publicId/trash`
- `POST /:publicId/restore`
- `DELETE /:publicId`

Body comum opcional:

```json
{
  "expectedVersion": 3,
  "reason": "Concluido no fechamento do dia."
}
```

## Reminders

`POST /:publicId/reminders`

Body reutiliza campos seguros de agenda:

```json
{
  "title": "Revisar documentos",
  "description": "Lembrete criado a partir do Focus Board.",
  "startsAt": "2026-07-15T09:00:00-03:00",
  "endsAt": null,
  "timezone": "America/Sao_Paulo",
  "isAllDay": false,
  "priority": "NORMAL",
  "notificationPolicy": "ONE_BUSINESS_DAY_BEFORE",
  "notificationTime": "09:00"
}
```

O backend fixa categoria/fonte e cria `focus_board_note_reminder`.

## Eventos

`GET /:publicId/events`

Retorna eventos visiveis para quem pode ler a nota.

```json
{
  "data": {
    "items": [
      {
        "publicId": "fce_...",
        "eventType": "CREATED",
        "summary": "Nota criada.",
        "actorName": "Diego",
        "createdAt": "2026-07-12T10:00:00-03:00"
      }
    ]
  },
  "meta": {
    "authorizedTotal": 1
  }
}
```

## Codigos de erro

- `FOCUS_BOARD_NOTE_NOT_FOUND`
- `FOCUS_BOARD_NOTE_FORBIDDEN`
- `FOCUS_BOARD_INVALID_CONTEXT`
- `FOCUS_BOARD_INVALID_PARTICIPANT`
- `FOCUS_BOARD_INVALID_TRANSITION`
- `FOCUS_BOARD_VERSION_CONFLICT`
- `FOCUS_BOARD_MIGRATION_CONFLICT`

Nenhum erro pode incluir titulo/corpo de nota bloqueada.
