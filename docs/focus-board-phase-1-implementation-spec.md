# Focus Board - Especificacao de Implementacao Fase 1

Data de referencia: `2026-07-12`.

Status: implementado localmente em `2026-07-12`.

Este documento define o primeiro incremento codavel do backend do Focus Board.
O schema, migration, modulo Nest, controller, service e testes de service foram
implementados. Smoke manual multiusuario/multitenant e deploy online continuam
como validacoes de rollout.

## Objetivo da Fase 1

Substituir a dependencia futura de `shared_preferences` por um backend proprio
para notas/tarefas, sem anexos diretos e sem conversao para ocorrencia, agenda
ou timeline.

Fase 1 entrega:

- tabelas de nota, participantes, contextos, eventos e lembretes;
- modulo Nest `focus-board`;
- CRUD protegido por tenant e ACL;
- transicoes de status;
- eventos de auditoria de produto e `AuditLog`;
- idempotencia para migracao manual de notas locais;
- testes de service para tenant, ACL, PATCH e soft delete.

Fase 1 nao entrega:

- anexos diretos em nota;
- conversao de nota em ocorrencia/evento;
- busca global retornando notas;
- relatorios de notas;
- permissao administrativa global para ler notas privadas;
- migracao automatica de notas locais.

## Ordem de trabalho recomendada

1. Criar migration Prisma com enums e modelos do draft.
2. Rodar `prisma format` e `prisma generate`.
3. Criar `FocusBoardModule`.
4. Criar DTOs de listagem, create, update, status e reminder.
5. Implementar `FocusBoardNotesService`.
6. Implementar `FocusBoardNotesController`.
7. Registrar modulo em `AppModule`.
8. Adicionar testes de service.
9. Rodar validacoes locais.
10. So depois liberar adapter do front.

## Arquivos esperados

Novos arquivos backend:

- `src/modules/focus-board/focus-board.module.ts`
- `src/modules/focus-board/focus-board-notes.controller.ts`
- `src/modules/focus-board/focus-board-notes.service.ts`
- `src/modules/focus-board/dto/list-focus-board-notes-query.dto.ts`
- `src/modules/focus-board/dto/create-focus-board-note.dto.ts`
- `src/modules/focus-board/dto/update-focus-board-note.dto.ts`
- `src/modules/focus-board/dto/focus-board-note-context.dto.ts`
- `src/modules/focus-board/dto/focus-board-note-participant.dto.ts`
- `src/modules/focus-board/dto/create-focus-board-reminder.dto.ts`

Arquivos existentes a tocar:

- `prisma/schema.prisma`
- `src/app.module.ts`
- `src/common/tenant/tenant-scope.ts`, apenas para incluir novos where inputs
  no tipo `TenantScopedWhere`.

Nao tocar:

- Auth bypass, Swagger, CORS e env sem necessidade direta.
- Services de ocorrencias, anexos, timeline ou agenda fora das chamadas
  explicitamente necessarias para lembretes.
- Front antes do backend passar nos testes.

## Regras de service

### Criacao

- Resolver actor por `actor.sub`.
- Obter tenant de `actor.tenantRootCompany`.
- Criar owner como participante `OWNER`.
- Validar contextos por `publicId` e tenant.
- Para `visibility=PRIVATE`, aceitar apenas owner e participantes `USER`
  explicitamente informados.
- Para `visibility=SHARED`, exigir ao menos um participante alem do owner.
- Gravar evento `CREATED` e `AuditLog`.
- Se `clientMigrationId` vier preenchido, usar idempotencia por owner/tenant.

### Listagem

- Aplicar `tenantWhere`.
- Aplicar ACL antes de retornar item.
- Retornar somente itens autorizados.
- `authorizedTotal` conta apenas itens autorizados.
- `search` busca em titulo/corpo apenas dentro de itens autorizados.

### Detalhe

- Sem permissao, nao retornar titulo, corpo, contexto ou contagem.
- Retornar `permissions` com flags `canEdit`, `canComplete`, `canArchive`,
  `canTrash`, `canRestore`, `canDelete`.

### Atualizacao

- Campo omitido preserva valor.
- `null` limpa somente campo explicitamente anulavel.
- `contexts` ou `participants` enviados substituem lista inteira em transacao.
- Mudanca de visibilidade grava evento proprio.
- Incrementar `version`.

### Status

- `complete`: aplica regra de `completionMode`.
- `reopen`: limpa conclusao da nota e participantes quando aplicavel.
- `archive`: somente nota ativa/concluida.
- `trash`: soft delete operacional.
- `restore`: volta de `TRASHED` para `ACTIVE` ou `COMPLETED`, conforme estado
  anterior guardado no evento.
- `DELETE`: marca `DELETED`; nao apaga fisicamente.

## Transacoes

Usar transacao Prisma quando a operacao alterar:

- nota e participantes;
- nota e contextos;
- nota e evento;
- nota e `AuditLog`;
- nota e reminder;
- migracao idempotente.

## Erros esperados

- `400`: payload invalido, contexto inexistente, combinacao de participantes
  invalida, status nao transicionavel.
- `401`: usuario sem sessao valida.
- `403`: usuario autenticado sem permissao para mutacao conhecida.
- `404`: nota inexistente ou nao visivel.
- `409`: conflito de versao ou migracao duplicada sem payload compativel.

Mensagens nao devem revelar conteudo da nota bloqueada.

## Criterio de pronto

- Migration aplicada localmente.
- `npm.cmd run prisma:format`.
- `npm.cmd run prisma:generate`.
- `npm.cmd run build`.
- Testes de service passando (`npm.cmd test`).
- Usuario A nao ve nota privada do usuario B no mesmo tenant.
- Usuario de outro tenant nao acessa nota por `publicId`.
- `PATCH` omitindo chave preserva valor.
- `DELETE` marca `DELETED` e grava auditoria.
- Front antigo continua funcional sem consumir o endpoint.
