# Client Onboarding e Isolamento por Empresa Raiz

Data de referencia: `2026-05-12`.

## Fluxo ativo

O login do front tem a acao publica `Cadastrar novo cliente`. Ela usa rotas
sem Bearer porque o usuario ainda nao existe no Firebase:

- `GET /api/v1/public/client-onboarding/options`
- `GET /api/v1/public/client-onboarding/cnpj-status?cnpj=...`
- `POST /api/v1/public/client-onboarding/verification/start`
- `POST /api/v1/public/client-onboarding`

O backend valida o CNPJ contra o registry comercial
`cliente_onboarding_cnpj_registry`, sem depender de dados hardcoded em runtime.
O seed local ainda popula exemplos `AVAILABLE`, `AVAILABLE_FOR_TEST`, `IN_USE`
e `UNAVAILABLE` quando a tabela esta vazia. A resposta publica mascara e-mail e
telefone, para nao vazar o contato completo na tela de login.

Rotas internas autenticadas:

- `GET /api/v1/client-onboarding/requests`
- `POST /api/v1/client-onboarding/requests/:publicId/approve`
- `POST /api/v1/client-onboarding/requests/:publicId/reject`

## Regra de liberacao

- CNPJ `AVAILABLE`: vira `ACTIVE_CLIENT`.
- CNPJ `AVAILABLE_FOR_TEST`: vira `DEMO_ACCESS`.
- CNPJ `IN_USE` ou `UNAVAILABLE`: gera solicitacao indisponivel e nao cria
  empresa raiz.
- Se a verificacao em duas etapas for aceita, o usuario precisa pedir um codigo
  por e-mail/telefone previamente vinculado ao CNPJ e enviar o codigo de 6
  digitos antes do vencimento.
- Se o codigo expirar, falhar ou nao for enviado, a
  solicitacao fica `PENDING_REVIEW` e registra
  `reviewNotificationEmail=diego.c94@yahoo.com`.
- A liberacao imediata cria a empresa raiz, trava exclusao, ativa o primeiro
  usuario administrador com MFA sugerido e grava trilha de auditoria.

O envio de e-mail ja usa `notification_outbox` com worker SMTP. Quando
`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM` estiverem configurados,
o worker processa mensagens `EMAIL`, marca como `SENT` em sucesso e como
`FAILED` apos o limite de tentativas. SMS/WhatsApp continuam reservados para
adapters futuros.

## Dados salvos

Novas tabelas:

- `empresa_raiz_cliente`: cadastro proprio da empresa cliente raiz. Sempre
  nasce com `isRootCompany=true` e `deletionLocked=true`.
- `cliente_onboarding_solicitacao`: trilha da solicitacao publica, incluindo
  status do CNPJ, tipo de contrato, cotas iniciais por perfil, canal de
  verificacao e data/hora de submissao.
- `cliente_onboarding_cnpj_registry`: lista comercial administravel dos CNPJs
  liberados, em uso, de teste ou indisponiveis.
- `cliente_onboarding_verificacao`: desafios de codigo expirarivel, com hash,
  tentativas e status.
- `notification_outbox`: fila interna de mensagens a enviar.

Campos opcionais `tenantRootCompanyId` foram adicionados aos cadastros
principais: usuarios, prestadoras, clientes, contratos, pessoas, postos,
vinculos, ocorrencias, anexos, tags, agenda, eventos de seguranca e auditoria.
Eles sao opcionais para manter compatibilidade com os dados legados e permitir
migracao progressiva antes de uso real por clientes.

## Seguranca e hierarquia

Regra-alvo para producao com clientes reais:

- toda rota autenticada deve resolver `tenantRootCompanyId` do usuario logado;
- consultas e mutacoes devem aplicar esse tenant no `where`;
- perfis (`ADMIN`, `EXECUTIVE`, `LEGAL`, `HR`, `OPERATIONS`) continuam
  decidindo profundidade de acesso dentro do tenant;
- anexos, tags sensiveis e relatorios continuam respeitando audience groups e
  step-up sensivel;
- usuarios de uma empresa nunca podem consultar dados de outra empresa;
- dados compartilhados, como personalizacao de calendario, devem gravar
  `tenantRootCompanyId` e log de inclusao, alteracao e exclusao.

Estado atual: o guard privilegiado exige empresa raiz para usuarios reais e os
services centrais aplicam escopo por tenant em empresas, pessoas, contratos,
postos, vinculos, ocorrencias, anexos, tags, agenda, network, dashboard e
relatorios. O token local de desenvolvimento (`firebase-dev-local`) e a unica
excecao sem tenant, apenas fora de producao.

## AWS e operacao

- Manter `DEV_AUTH_BYPASS=false` e `PREVIEW_AUTH_BYPASS=false` em host publico.
- Manter CORS restrito ao dominio publicado.
- A rota publica tem rate limit em memoria para desenvolvimento/MVP. Em
  producao, manter tambem WAF/Captcha/reverse proxy rate limit.
- Nao expor raw contacts da lista comercial em resposta publica.
- Nao deletar dados legados por migration; quando a base real for iniciada,
  limpar ou arquivar dados por processo controlado, com backup.

## Proximas entregas relacionadas

1. Adapters reais de SMS/WhatsApp a partir de `notification_outbox`.
2. Administracao completa do registry comercial de CNPJs.
3. Vinculo assistido do primeiro usuario Firebase ao usuario interno criado.
4. Captcha/WAF em producao para o formulario publico.
5. Consulta externa de CNPJ/Receita ou fornecedor equivalente.
6. Personalizacao de calendario por empresa raiz com auditoria completa.
