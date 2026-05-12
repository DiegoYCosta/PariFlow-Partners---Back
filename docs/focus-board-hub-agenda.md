# Focus Board Hub e Agenda

Status: implementado em 2026-05-11 como integracao nativa do PariFlow
Partners. O app FocusBoard antigo continua separado; o hub novo reaproveita
os contratos existentes do PariFlow para evitar dependencia visual/tecnica
externa e reduzir risco de regressao.

## Objetivo

O hub do colaborador substitui a ideia de cards aleatorios por um painel
contextual dentro da ficha de pessoas. Ele mostra somente conteudo que o
backend ja liberou para a sessao atual:

- lembretes e compromissos vinculados ao colaborador;
- previews de documentos e anexos autorizados;
- previews de fotos/imagens autorizadas;
- detalhes contextuais vindos de tags sensiveis quando a ACL permite.

## Processo atual

1. O front abre a ficha em `PeopleWorkspace`.
2. A camada `people_api_data.dart` carrega pessoa, vinculos, ocorrencias,
   anexos, tags e agenda.
3. Anexos e tags continuam vindo dos endpoints existentes, com a ACL aplicada
   no backend antes de chegar ao Flutter.
4. O painel `Hub do colaborador` renderiza apenas os itens recebidos.
5. O botao `Lembrete` cria um item em `POST /api/v1/agenda`.
6. Cancelamentos usam `DELETE /api/v1/agenda/:publicId`, que muda status para
   `CANCELED` e preserva historico.

Nenhum fluxo novo deve usar ID numerico no front. A troca entre front e API
continua por `publicId`.

## Backend e banco

Modulo: `src/modules/calendar`.

Endpoints:

- `GET /api/v1/agenda`
- `POST /api/v1/agenda`
- `PATCH /api/v1/agenda/:publicId`
- `DELETE /api/v1/agenda/:publicId`

Tabela Prisma/MySQL: `agenda_item`.

Campos de notificacao adicionados:

- `notificationPolicy`
- `notificationOffsetBusinessDays`
- `notificationTime`
- `notificationScheduledAt`
- `notificationChannelsJson`

Politicas suportadas:

- `ON_DUE_DATE`: notifica no dia do evento;
- `ONE_BUSINESS_DAY_BEFORE`: notifica 1 dia util antes;
- `SAME_DAY_OR_PREVIOUS_BUSINESS_DAY`: notifica no dia se for util, ou no dia
  util anterior quando cair em final de semana/feriado fixo;
- `CUSTOM_BUSINESS_DAYS_BEFORE`: notifica N dias uteis antes.

O calculo atual considera finais de semana e feriados nacionais fixos do
Brasil. Feriados regionais e moveis devem entrar no mesmo ponto de extensao,
sem mudar o contrato publico da API.

## Seguranca e hierarquia

Guards obrigatorios:

- `InternalAuthGuard`: exige Bearer token interno valido;
- `PrivilegedAccessGuard`: exige `securityContext` privilegiado, sensivel
  verificado ou critico verificado.

ACL fina ja existente:

- Anexos: dono, usuarios autorizados e grupos autorizados.
- Tags sensiveis: dono, usuarios autorizados e grupos autorizados.
- Hub: nao tenta reconstruir permissao no front; ele exibe somente o payload
  ja autorizado pela API.

Agenda atual:

- criar exige usuario interno privilegiado;
- editar/cancelar permite criador, responsavel ou perfil privilegiado;
- toda criacao, edicao e cancelamento registra `log_auditoria`;
- conteudo de agenda ainda nao tem ACL propria por grupo/usuario. Se um
  compromisso passar a conter dados sensiveis, adicionar `audienceGroups` e
  `audienceUsers` a `agenda_item` antes de liberar para perfis amplos.

Matriz esperada para a proxima fase:

| Perfil | Agenda operacional | Anexos formais | Tags sensiveis | Criticos |
| --- | --- | --- | --- | --- |
| Operacional privilegiado | Ler/criar no seu escopo | Conforme ACL | Nao | Nao |
| RH | Ler/criar/gerir | Conforme ACL | Conforme grupo RH | Com step-up |
| Gestor contrato | Ler/criar no contrato | Conforme ACL | Somente liberado | Nao |
| Admin/compliance | Gerir | Conforme ACL | Com sessao sensivel | Com sessao critica |

O front pode esconder acoes por conveniencia, mas o bloqueio real deve ficar
sempre na API.

## Relatorios

O tipo `controls_calendar` deve ser usado para relatorios de lembretes e
compromissos em qualquer periodo, passado ou futuro. Todo relatorio gerado
deve manter no cabecalho:

- data e hora exata de geracao;
- nome e publicId do usuario gerador;
- empresa/publicId vinculada ao usuario quando houver;
- nivel de permissao/securityContext da sessao.

As colunas de agenda incluem data alvo, politica de notificacao, data/hora
agendada de notificacao e canais. Isso cobre lembretes em finais de semana,
feriados e consultas retroativas.

## AWS e anexos reais

Quando previews reais de arquivos entrarem:

- usar bucket S3 privado, sem objeto publico;
- gerar URL assinada curta ou thumbnail assinada pelo backend;
- thumbnails de documentos sensiveis devem herdar a mesma ACL do anexo;
- nunca armazenar link S3 bruto no front;
- CloudFront, se usado, deve ficar com signed cookies/URLs e origem privada;
- eventos de notificacao devem usar EventBridge/SQS/Lambda ou worker NestJS
  com fila duravel;
- canais provaveis: in-app no banco, email via SES, push via Firebase Cloud
  Messaging, webhook com assinatura HMAC e retry.

## Compatibilidade e nao regressao

- Nao foi adicionada dependencia do pacote FocusBoard ao app principal.
- O FocusBoard antigo permanece como referencia, nao como runtime.
- Endpoints existentes de pessoas, ocorrencias, anexos e tags nao mudaram.
- ACL de anexos/tags continua sendo a fonte de verdade.
- A agenda usa colunas novas com defaults, preservando linhas existentes.
- Cancelamento e remocao seguem padrao logico/auditavel.
- O front local deve continuar em `127.0.0.1:8082`; backend local em
  `127.0.0.1:3000`.

## Validacao obrigatoria antes de promover

```powershell
npm.cmd run prisma:format
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
npm.cmd run build
flutter analyze
flutter test --reporter=compact
```

Tambem validar manualmente:

- abrir ficha de colaborador no hub;
- criar lembrete de experiencia com `1 dia util antes`;
- criar lembrete com `No dia ou util anterior` em uma data de fim de semana;
- cancelar lembrete e confirmar que ele muda para `Cancelado`;
- conferir que anexos/tags nao autorizados nao aparecem no hub.
