# Focus Board Hub e Agenda

Data de referencia: `2026-05-14`.

Status: implementado como integracao nativa do PariFlow Partners. A Focus Board
antiga permanece apenas como referencia; o runtime atual usa os contratos e
servicos do PariFlow.

## Estado atual

- A Focus Board e componente persistente do shell CRM.
- Ela pode ficar acoplada ao canto superior direito ou abrir em janela/pagina
  propria no web.
- O estado fica em `_FocusBoardPersistentController` e nao e recriado a cada
  troca de pagina.
- `PeopleWorkspace` informa o colaborador selecionado ao controlador global.
- `people_api_data.dart` carrega pessoa, vinculos, ocorrencias, tags, anexos e
  agenda diretamente da API.
- Lembretes usam `POST /api/v1/agenda`.
- Cancelamentos usam `DELETE /api/v1/agenda/:publicId`, preservando historico.
- Anexos e tags continuam obedecendo ACL do backend.
- Acesso a anexo digital passa por `GET /api/v1/anexos/:publicId/access`,
  gerando URL auditavel e respeitando storage privado, permissao de download e
  step-up sensivel.
- O painel de anexos da ficha mostra a proxima agenda vinculada da pessoa, para
  manter o contexto de calendario junto da decisao de acesso.
- Preferencias de calendario sao persistidas por usuario no tenant autenticado
  em `auth/preferences/calendar`.

## Perfis e configuracoes

O menu de usuario do topo abre `Perfis e configuracoes` com abas de:

- perfil;
- conta;
- seguranca;
- personalizacao;
- contatos;
- calendario;
- onboarding;
- WhatsApp Agentic AI Workflow reservado.

A aba `Calendario` ja consome `agenda`, `agenda/non-business-days` e
`agenda/applicability`, mostrando calendario mensal, filtros manuais, cadastro
de dias nao uteis e aplicabilidade por cidade/estado/regiao.

A aba `Onboarding` consome `client-onboarding/requests` e permite aprovar ou
negar solicitacoes internas.

## Backend usado

- `GET /api/v1/agenda`
- `POST /api/v1/agenda`
- `PATCH /api/v1/agenda/:publicId`
- `DELETE /api/v1/agenda/:publicId`
- `GET /api/v1/agenda/non-business-days`
- `POST /api/v1/agenda/non-business-days`
- `DELETE /api/v1/agenda/non-business-days/:publicId`
- `GET /api/v1/agenda/applicability`
- `GET /api/v1/pessoas`
- `GET /api/v1/pessoas/:publicId`
- `GET/POST/PATCH/DELETE /api/v1/ocorrencias`
- `GET/POST/PATCH/DELETE /api/v1/anexos`
- `GET /api/v1/anexos/:publicId/access`
- `GET/POST/PATCH/DELETE /api/v1/tags-entidade`
- `POST /api/v1/auth/sensitive-session/start`
- `POST /api/v1/auth/sensitive-session/verify`
- `GET/PATCH /api/v1/auth/preferences/calendar`
- `GET /api/v1/auth/access-context`

## Seguranca

- O front nunca reconstrui permissao sensivel por conta propria.
- O backend filtra anexos, tags e dados protegidos antes de responder.
- Criacao e cancelamento de agenda exigem sessao interna privilegiada.
- Downloads de anexos respeitam `canDownloadAttachments`; visualizacao sem
  download continua auditavel quando liberada.
- Itens de agenda com conteudo sensivel devem continuar passando por
  audience/step-up antes de liberar para perfis amplos.

## Pendencias reais restantes

1. Evoluir comunicados com preview de audiencia e confirmacao de ciencia.
2. Validar responsividade da janela desacoplada em mobile/tablet.
