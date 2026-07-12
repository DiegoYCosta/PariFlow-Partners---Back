# Focus Board - Migracao de Notas Locais

Data de referencia: `2026-07-12`.

Status: plano de migracao. Nao implementar upload automatico.

## Contexto

O front atual salva notas do Focus Board em `shared_preferences`. Essas notas
podem conter informacao operacional ou pessoal. Migrar sem acao explicita do
usuario pode vazar dados para o tenant errado ou para uma conta errada.

## Principios

- Migracao sempre manual.
- Usuario precisa estar autenticado.
- Tenant vem da sessao backend.
- Nota local original permanece ate sucesso confirmado.
- Falha parcial nao apaga dado local.
- Idempotencia por `clientMigrationId`.

## Identificador idempotente

Gerar `clientMigrationId` local por nota, preservado em storage:

Formato recomendado:

`local-v1:<device-scope>:<local-note-id>`

Regras:

- nao incluir nome, email, titulo ou conteudo no identificador;
- maximo 80 caracteres;
- se nota nao tiver ID local estavel, criar antes de migrar e persistir;
- backend valida duplicidade por owner/tenant.

## Fluxo

1. Front detecta notas locais nao migradas.
2. Exibe estado "notas locais pendentes de migracao".
3. Usuario aciona migracao.
4. Front mostra resumo numerico local, sem enviar ainda.
5. Front envia cada nota com `clientMigrationId`.
6. Backend cria ou retorna existente.
7. Front grava `remotePublicId` e `migratedAt` localmente.
8. Nota migrada passa a renderizar dado backend.
9. Em erro, front mantem nota local e mostra falha recuperavel.

## Payload de migracao

Usar o mesmo `CreateFocusBoardNoteDto` com:

- `clientMigrationId`;
- owner inferido pelo backend;
- contextos resolvidos apenas quando houver publicId confiavel;
- participantes locais desconhecidos descartados ou marcados para revisao;
- `visibility=PRIVATE` por padrao, salvo se a nota local tiver regra segura.

## Conflitos

Mesmo `clientMigrationId` e payload compativel:

- retornar `200` com nota existente.

Mesmo `clientMigrationId` e payload divergente:

- retornar `409 FOCUS_BOARD_MIGRATION_CONFLICT`;
- front nao apaga nota local;
- usuario pode escolher manter local, duplicar com novo ID ou ignorar.

## O que nao migrar automaticamente

- notas sem titulo/corpo minimo;
- participantes locais sem publicId backend;
- anexos locais;
- relacoes inferidas por label textual;
- notas marcadas como lixeira se o usuario optar por ignorar arquivadas/lixeira.

## Criterio de aceite

- repetir migracao nao duplica nota.
- erro parcial preserva notas locais.
- usuario pode cancelar antes de enviar.
- migracao de usuario A nao cria nota para usuario B.
- tenant errado nao recebe nota local.
