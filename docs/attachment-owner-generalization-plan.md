# Anexos - Plano de Generalizacao de Dono

Data de referencia: `2026-07-12`.

Status: planejamento futuro. Nao bloquear Focus Board Fase 1.

## Problema

`Attachment` hoje exige `occurrenceId`. Isso e correto para anexos formais de
ocorrencia, mas impede anexar arquivo diretamente a nota, pessoa, contrato ou
evento sem criar relacao falsa.

## Regra principal

Nao criar ocorrencia falsa para hospedar anexo de nota.

## Opcoes

### Opcao A - FKs opcionais no Attachment

Adicionar campos:

- `focusBoardNoteId`
- `personId`
- `contractId`
- `calendarEntryId`
- outros quando necessario.

Service garante exatamente um dono.

Vantagem: menor numero de joins.

Risco: tabela cresce com muitos campos opcionais.

### Opcao B - Tabela `attachment_owner`

Manter `Attachment` como arquivo protegido e criar dono separado:

- `attachmentId`
- `ownerType`
- FKs opcionais ou `ownerPublicId` validado.

Vantagem: extensivel.

Risco: exige refactor maior em listagem e acesso.

## Recomendacao inicial

Para anexos de nota, preferir avaliar Opcao B antes de alterar o modelo, porque
o produto tende a precisar de anexos por pessoa, contrato, evento e nota.

## Regras preservadas

- step-up sensivel;
- URL assinada;
- audience groups/users;
- audit log de download/visualizacao;
- tenant isolation;
- soft delete.

## Criterio para iniciar

- Focus Board Notes Fase 1 implementado;
- fluxo real pedindo anexo direto em nota;
- impacto em ocorrencias mapeado;
- migration e rollback documentados.
