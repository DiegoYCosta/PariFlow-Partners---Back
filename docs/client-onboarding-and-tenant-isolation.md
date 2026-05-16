# Client Onboarding e Isolamento por Empresa Raiz

Data de referencia: `2026-05-14`.

## Fluxo ativo

O login do front tem a acao publica `Cadastrar novo cliente`. Ela usa rotas sem
Bearer porque o usuario ainda nao existe no Firebase:

- `GET /api/v1/public/client-onboarding/options`
- `GET /api/v1/public/client-onboarding/cnpj-status?cnpj=...`
- `GET /api/v1/public/client-onboarding/cnpj/:cnpj/status`
- `POST /api/v1/public/client-onboarding/verification/start`
- `POST /api/v1/public/client-onboarding`

O backend valida CNPJ contra `cliente_onboarding_cnpj_registry`, sem depender
de hardcode em runtime. A resposta publica mascara contato para nao vazar e-mail
ou telefone completo.

Rotas internas autenticadas:

- `GET /api/v1/auth/access-context`
- `POST /api/v1/auth/company-context`
- `POST /api/v1/auth/access-request`
- `GET /api/v1/client-onboarding/requests`
- `POST /api/v1/client-onboarding/requests/:publicId/approve`
- `POST /api/v1/client-onboarding/requests/:publicId/reject`

O front ja possui aba interna de Onboarding em `Perfis e configuracoes`.

## Regra de liberacao

- CNPJ `AVAILABLE`: vira `ACTIVE_CLIENT`.
- CNPJ `AVAILABLE_FOR_TEST`: vira `DEMO_ACCESS`.
- CNPJ `IN_USE` ou `UNAVAILABLE`: gera solicitacao indisponivel e nao cria
  empresa raiz.
- Verificacao em duas etapas usa codigo de 6 digitos por e-mail, telefone ou
  WhatsApp previamente vinculado ao CNPJ.
- Se codigo expirar, falhar ou nao for enviado, a solicitacao fica
  `PENDING_REVIEW` e registra e-mail de revisao.
- Liberacao imediata cria empresa raiz, trava exclusao, ativa primeiro usuario
  administrador e grava auditoria.

## Dados salvos

- `empresa_raiz_cliente`
- `cliente_onboarding_solicitacao`
- `cliente_onboarding_cnpj_registry`
- `cliente_onboarding_verificacao`
- `notification_outbox`
- `usuario_empresa_raiz_acesso`

Campos opcionais `tenantRootCompanyId` existem nos cadastros principais para
permitir migracao progressiva e isolamento por empresa raiz.
`refresh_tokens.tenantRootCompanyId` preserva a empresa ativa escolhida pelo
usuario durante a sessao longa.

## Seguranca e hierarquia

- Rotas autenticadas resolvem tenant pelo usuario real.
- Services centrais aplicam escopo por tenant em empresas, pessoas, contratos,
  postos, vinculos, ocorrencias, anexos, tags, agenda, network, dashboard e
  relatorios.
- Depois do Firebase e da sessao interna, o front exige confirmacao do contexto
  empresarial aprovado antes de abrir o aplicativo.
- Um mesmo usuario Firebase pode ter mais de um vinculo ativo em
  `usuario_empresa_raiz_acesso`; apenas um `tenantRootCompanyId` entra no token
  assinado por vez.
- A troca de empresa nao aceita publicId vindo de URL, cookie editavel ou
  estado local como autoridade. O backend valida o vinculo ativo antes de emitir
  nova sessao escopada.
- Sem empresa vinculada, o usuario fica no gate de solicitacao de acesso e ve
  apenas os documentos da propria etapa de analise via `auth/access-context`.
- Perfis `ADMIN`, `EXECUTIVE`, `LEGAL`, `HR` e `OPERATIONS` controlam
  profundidade dentro do tenant.
- Anexos, tags e relatorios continuam respeitando audience groups e step-up.
- `firebase-dev-local` e a excecao sem tenant, somente fora de producao.

## Pendencias reais

1. Adapter real de SMS.
2. Administracao completa do registry comercial de CNPJs.
3. Tela administrativa para aprovar/revogar vinculos adicionais por empresa e
   perfil, registrando auditoria da decisao.
4. Captcha/WAF/reverse proxy rate limit em producao.
5. Consulta externa de CNPJ/Receita ou fornecedor equivalente.
6. Rotina operacional para limpar/arquivar dados legados antes de clientes reais.
