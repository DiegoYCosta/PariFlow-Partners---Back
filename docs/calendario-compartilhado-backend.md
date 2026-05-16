# Calendario Compartilhado, Banco e Notificacoes

Data de referencia: `2026-05-14`.

Este documento descreve o estado real do backend de agenda/calendario. A agenda
ja nao e apenas uma ideia de backlog: existe modulo NestJS, tabelas Prisma,
endpoints, calculo de dia util, dias nao uteis e consumo pelo front.

## Implementado hoje

- modulo `src/modules/calendar`;
- tabela `agenda_item`;
- tabela `agenda_dia_nao_util`;
- `CalendarEntryKind` com `REMINDER`, `APPOINTMENT` e `NOTICE`;
- filtros por periodo, cadastro, pessoa, prestadora, cliente, contrato, vinculo,
  posto, tipo de contrato, classificacao/categoria, recorrencia, regiao,
  estado, cidade e inclusao de desligados;
- calculo de `notificationScheduledAt`;
- politicas `ON_DUE_DATE`, `ONE_BUSINESS_DAY_BEFORE`,
  `SAME_DAY_OR_PREVIOUS_BUSINESS_DAY` e `CUSTOM_BUSINESS_DAYS_BEFORE`;
- finais de semana, feriados nacionais fixos do Brasil e dias nao uteis
  cadastrados por tenant/regiao entram no calculo de dia util;
- feriados nacionais do Brasil sao listados por padrao ate 2050;
- `GET /api/v1/agenda/applicability` mostra pessoas e empresas relacionadas a
  cidade/estado/regiao;
- criacao, edicao, cancelamento e desativacao gravam auditoria;
- comunicados `NOTICE` podem carregar audiencia por perfil/tipo de contrato e
  gerar `notification_outbox`;
- worker SMTP envia e-mail quando `SMTP_*` estiver configurado;
- WhatsApp Cloud API fica disponivel quando `WHATSAPP_*` estiver configurado;
- relatorio `controls_calendar` retorna itens de agenda com notificacao, canal,
  dia nao util, aplicabilidade, metadados e CSV.

## Endpoints atuais

- `GET /api/v1/agenda`
- `POST /api/v1/agenda`
- `PATCH /api/v1/agenda/:publicId`
- `DELETE /api/v1/agenda/:publicId`
- `GET /api/v1/agenda/non-business-days`
- `POST /api/v1/agenda/non-business-days`
- `DELETE /api/v1/agenda/non-business-days/:publicId`
- `GET /api/v1/agenda/applicability`
- `POST /api/v1/relatorios/executar` com template `controls_calendar`

Ainda nao existem rotas separadas `GET/POST/PATCH/DELETE /api/v1/calendarios`.
O contrato vigente permanece em `/agenda`.

## Modelagem vigente

`agenda_item` guarda o item operacional:

- tipo (`REMINDER`, `APPOINTMENT`, `NOTICE`);
- status;
- prioridade;
- alvo por pessoa, empresa, cliente, contrato, vinculo ou posto;
- categoria;
- regra de recorrencia simples;
- audiencia serializada;
- data do evento;
- escopo geografico;
- politica de dia util e notificacao;
- canais de notificacao;
- autoria, responsavel, justificativa de edicao e auditoria.

`agenda_dia_nao_util` guarda feriados/dias nao uteis:

- tenant;
- data;
- nome;
- escopo;
- regiao, estado e cidade;
- recorrencia anual;
- ativo/inativo;
- usuario criador.

Data de cadastro (`createdAt`) e data do evento/regra (`startsAt` ou `date`)
nao devem ser confundidas.

## Regras de dia util

O calculo considera:

1. finais de semana;
2. feriados nacionais fixos do Brasil;
3. dias nao uteis cadastrados por tenant/regiao/estado/cidade;
4. politica do item de agenda.

Exemplo: se Campinas tiver um dia nao util em 20/05/2026 e um lembrete vencer
em 21/05/2026 com `ONE_BUSINESS_DAY_BEFORE`, a notificacao deve cair em
19/05/2026.

## Integracao com front

O front consome:

- Focus Board/People: lembretes por colaborador;
- popup de `Perfis e configuracoes`: calendario mensal, dias nao uteis,
  cadastro de feriado/dia nao util, aplicabilidade e onboarding interno;
- Timeline: calendario operacional mensal com agenda, dias nao uteis e
  registros de timeline;
- Central de Relatorios: `controls_calendar`.
- Preferencias salvas por usuario/tenant: `GET/PATCH /api/v1/auth/preferences/calendar`.

## Pendencias reais

1. Criar preview formal de audiencia antes de comunicado.
2. Registrar snapshot detalhado de destinatarios quando a audiencia for enviada.
3. Adicionar confirmacao de ciencia.
4. Evoluir `controls_calendar` para listar tambem dias nao uteis como linhas
   proprias quando necessario.
5. Trocar worker local por SES/SQS/EventBridge ou fila duravel equivalente em
   producao.
6. Ampliar feriados moveis/regionais por fonte externa quando houver decisao de
   produto.
