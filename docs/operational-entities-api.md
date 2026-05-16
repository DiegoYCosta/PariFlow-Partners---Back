# API de Entidades Operacionais

Data de referencia: `2026-05-15`.

Este documento consolida o planejamento antigo de Contracts, Clients e
Companies no ponto de vista do backend. A API atual ja cobre os CRUDs centrais;
o proximo trabalho deve ser enriquecimento pontual de payload, nao recriacao de
cadastro basico.

## Regras de contrato

- Todo relacionamento consumido pelo front usa `publicId`.
- `id` interno de banco nunca deve ser exposto como referencia de UI.
- Todas as consultas operacionais precisam passar por `tenantWhere` ou relacao
  equivalente de empresa raiz.
- Inativar registros preserva historico; nao apagar contratos, vinculos,
  ocorrencias ou documentos relacionados.
- Payload novo deve ser aditivo sempre que possivel para nao quebrar os
  workspaces atuais.

## Empresas prestadoras

Endpoint base: `GET/POST/PATCH/DELETE /api/v1/empresas-prestadoras`.

Payload atual:

- `publicId`;
- `legalName`;
- `tradeName`;
- `document`;
- `status`;
- `contactsJson`;
- `addressJson`;
- `notes`;
- `contractCount`, `linkCount`, `occurrenceCount` em listagens com contadores.

Pendente real:

- incluir relacoes resumidas no detalhe quando o front precisar de clientes
  conectados, contratos em foco ou filas operacionais;
- manter a listagem leve para busca e paginacao.

## Clientes contratantes

Endpoint base: `GET/POST/PATCH/DELETE /api/v1/clientes`.

Payload atual:

- `publicId`;
- `name`;
- `document`;
- `clientType`;
- `addressJson`;
- `contactName`;
- `status`.

Pendente real:

- expor prestadoras ativas/historicas por cliente;
- expor contratos em foco;
- expor pessoas impactadas quando a tela pedir o contexto;
- preservar tenant por empresa raiz selecionada na sessao.

## Contratos

Endpoint base: `GET/POST/PATCH/DELETE /api/v1/contratos`.

Catalogos e extensoes:

- `GET/POST/PATCH/DELETE /api/v1/contratos/tipos`;
- `GET/POST/PATCH/DELETE /api/v1/contratos/modelos`;
- `GET/POST/PATCH/DELETE /api/v1/contratos/servicos`;
- `GET/POST /api/v1/contratos/:publicId/postos`;
- `PATCH/DELETE /api/v1/contratos/postos/:positionPublicId`;
- `GET/POST /api/v1/contratos/:publicId/documentos`;
- `PATCH/DELETE /api/v1/contratos/documentos/:documentPublicId`.

Payload atual de contrato:

- `publicId`;
- `startsAt`, `endsAt`, `status`, `notes`;
- `contractType`;
- `contractModel`;
- `providerCompany`;
- `clientCompany`;
- `positions`;
- `documents`.

Contratos ja carregam cliente e prestadora no payload principal. Esse e o
caminho preferencial para o front montar contexto basico sem chamadas extras.

## Criterios para evoluir payload

Antes de adicionar campos relacionais:

1. identificar a tela e o estado que consomem o campo;
2. definir se o dado pertence a listagem, detalhe ou endpoint proprio;
3. manter resposta paginada leve;
4. validar tenant no backend, nao no front;
5. documentar o campo aqui e no documento do front.

## Nao reabrir

- criar CRUD basico de empresas, clientes ou contratos;
- usar mock como fallback em runtime real;
- aceitar `id` interno no contrato de API;
- duplicar endpoints fora dos nomes atuais sem necessidade de compatibilidade.
