# Focus Board - Rollout e Feature Flag

Data de referencia: `2026-07-12`.

Status: plano operacional.

## Objetivo

Ligar o backend do Focus Board sem quebrar o app online em
`pariflowpartners.com.br` e sem perder notas locais existentes.

## Flags propostas

Backend:

- `FOCUS_BOARD_NOTES_ENABLED=false`
- `FOCUS_BOARD_NOTES_MIGRATION_ENABLED=false`
- `FOCUS_BOARD_NOTES_ATTACHMENTS_ENABLED=false`

Front:

- `PARIFLOW_FOCUS_BOARD_BACKEND_ENABLED=false`
- `PARIFLOW_FOCUS_BOARD_LOCAL_MIGRATION_ENABLED=false`

Defaults seguros:

- backend novo desligado ate migration e smoke;
- migracao desligada ate testes com usuario real;
- anexos desligados na Fase 1.

## Ambientes

Local:

- habilitar backend notes;
- usar dev-token apenas em loopback;
- usar banco local.

Preview:

- habilitar backend notes para usuarios controlados;
- migracao manual habilitada somente apos backup;
- logs de erro monitorados.

Producao:

- habilitar endpoints primeiro;
- manter front ainda lendo local ate smoke passar;
- habilitar front backend para pequeno grupo;
- habilitar migracao manual por ultimo.

## Plano de volta

Se API falhar:

- front mostra erro recuperavel;
- nao volta silenciosamente para local como se fosse backend;
- notas locais nao migradas continuam preservadas;
- flag front pode voltar para leitura local temporaria, rotulada como local.

Se migration DB falhar:

- restaurar backup antes de qualquer dado real migrado;
- apos dado real, desabilitar endpoints por flag e corrigir migration aditiva.

## Observabilidade minima

Registrar:

- erros de ACL;
- conflitos de migracao;
- latencia de listagem;
- volume de notas criadas;
- tentativas de acesso cross-tenant;
- falhas de reminder.

Nao registrar corpo completo da nota em log de aplicacao.

## Checklist de release

- backup do banco.
- migrations aplicadas.
- `npm.cmd run build` passou.
- smoke local passou.
- smoke preview passou com dois usuarios.
- flags revisadas.
- Swagger desligado em producao.
- auth bypass desligado em host publico.
