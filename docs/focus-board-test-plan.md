# Focus Board - Plano de Testes Backend

Data de referencia: `2026-07-12`.

Status: plano de testes para implementacao futura.

## Testes unitarios/service obrigatorios

### Tenant

- cria nota com tenant do actor.
- lista retorna apenas notas do tenant do actor.
- detalhe por `publicId` de outro tenant retorna sem conteudo.
- contexto `personPublicId` de outro tenant e rejeitado.
- body/query com tenant forjado e ignorado/rejeitado.

### ACL de leitura

- owner le nota privada.
- usuario do mesmo tenant sem participante nao le nota privada.
- participante `USER` le nota compartilhada.
- usuario com perfil participante le nota compartilhada.
- usuario com grupo participante le nota compartilhada.
- contexto de pessoa nao concede leitura sozinho.

### ACL de escrita

- owner edita.
- editor edita.
- viewer nao edita.
- assignee sem papel editor nao edita texto.
- usuario privilegiado nao le nota privada sem regra documentada.

### PATCH

- chave omitida preserva.
- `dueAt: null` limpa.
- `body: null` limpa.
- update de `contexts` substitui lista atomica.
- update de `participants` preserva owner.
- `expectedVersion` divergente retorna `409`.

### Status

- complete com `OWNER_ONLY`.
- complete com `FIRST_COMPLETES_ALL`.
- complete com `ALL_MUST_COMPLETE`.
- reopen limpa conclusoes.
- archive preserva conteudo.
- trash move para `TRASHED`.
- restore volta para estado anterior seguro.
- delete marca `DELETED`.
- deleted nao pode ser restaurado sem rotina administrativa futura.

### Auditoria

- create grava `FocusBoardNoteEvent` e `AuditLog`.
- update grava diff limitado.
- visibility change grava evento especifico.
- participant change grava evento.
- complete/archive/trash/delete gravam evento e audit.
- audit nao grava corpo completo quando desnecessario.

### Migracao local

- `clientMigrationId` novo cria nota.
- repetir mesmo `clientMigrationId` retorna nota existente.
- repetir `clientMigrationId` com payload divergente retorna `409`.
- migracao nao permite owner diferente.

### Lembretes

- criar reminder cria `CalendarEntry` e relacao.
- cancelar reminder cancela agenda e preserva nota.
- usuario sem permissao na nota nao cria reminder.
- reminder nao altera texto/status da nota automaticamente.

## Testes de controller

- valida DTOs invalidos.
- envelope de sucesso segue `{ data, meta }`.
- erro segue `{ error }`.
- rotas exigem autenticacao.
- query `limit` respeita maximo.
- search menor que minimo retorna `400`.

## Testes manuais obrigatorios

1. Usuario A cria nota privada.
2. Usuario B do mesmo tenant nao ve em lista, detalhe, Home ou Pessoas.
3. Usuario A compartilha com B.
4. Usuario B ve nota e nao edita se for viewer.
5. Usuario A vincula nota a Pessoa.
6. Pessoa mostra nota para A e B autorizado, nao para C.
7. Usuario de outro tenant tenta `publicId` conhecido e nao acessa.
8. Usuario cria reminder e ve item na Agenda.
9. Usuario apaga nota e ela sai da lista ativa.
10. Auditoria registra as mutacoes.

## Dados de fixture

Minimo:

- dois tenants;
- tres usuarios no mesmo tenant;
- um usuario em outro tenant;
- um perfil HR;
- um grupo sensivel;
- uma pessoa, contrato, cliente, prestadora, vinculo e posto por tenant.

## Comandos de validacao

```powershell
npm.cmd run prisma:format
npm.cmd run prisma:generate
npm.cmd run build
npm.cmd run lint
```

Quando houver suite automatizada, incluir comando especifico de teste de
service/controller.
