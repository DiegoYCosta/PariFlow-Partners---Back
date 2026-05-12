# Client Onboarding e Isolamento por Empresa Raiz

Data de referencia: `2026-05-12`.

## Fluxo ativo

O login do front tem a acao publica `Cadastrar novo cliente`. Ela usa rotas
sem Bearer porque o usuario ainda nao existe no Firebase:

- `GET /api/v1/public/client-onboarding/options`
- `GET /api/v1/public/client-onboarding/cnpj-status?cnpj=...`
- `POST /api/v1/public/client-onboarding`

O backend valida o CNPJ contra uma lista comercial interna em codigo. A lista
tem CNPJs `AVAILABLE`, `AVAILABLE_FOR_TEST`, `IN_USE` e `UNAVAILABLE`, cada um
com contato comercial previamente conhecido. A resposta publica mascara e-mail
e telefone, para nao vazar o contato completo na tela de login.

## Regra de liberacao

- CNPJ `AVAILABLE`: vira `ACTIVE_CLIENT`.
- CNPJ `AVAILABLE_FOR_TEST`: vira `DEMO_ACCESS`.
- CNPJ `IN_USE` ou `UNAVAILABLE`: gera solicitacao indisponivel e nao cria
  empresa raiz.
- Se a verificacao em duas etapas for aceita e o e-mail/telefone informado
  bater com o contato comercial vinculado ao CNPJ, a empresa raiz e liberada
  imediatamente.
- Se a verificacao for recusada, ou nao bater com o contato comercial, a
  solicitacao fica `PENDING_REVIEW` e registra
  `reviewNotificationEmail=diego.c94@yahoo.com`.

Nesta etapa o sistema registra o e-mail de analise, mas ainda nao envia e-mail
real. O envio deve entrar via modulo de notificacoes/job para evitar SMTP solto
em rota publica.

## Dados salvos

Novas tabelas:

- `empresa_raiz_cliente`: cadastro proprio da empresa cliente raiz. Sempre
  nasce com `isRootCompany=true` e `deletionLocked=true`.
- `cliente_onboarding_solicitacao`: trilha da solicitacao publica, incluindo
  status do CNPJ, tipo de contrato, cotas iniciais por perfil, canal de
  verificacao e data/hora de submissao.

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

Estado atual: a base esta preparada para tenant, mas os modulos legados ainda
nao bloqueiam por tenant porque os registros atuais podem estar com
`tenantRootCompanyId=null`. Antes de ativar clientes reais, executar a fase de
enforcement: vincular usuarios e dados existentes a uma empresa raiz e adicionar
filtros obrigatorios nos services.

## AWS e operacao

- Manter `DEV_AUTH_BYPASS=false` e `PREVIEW_AUTH_BYPASS=false` em host publico.
- Manter CORS restrito ao dominio publicado.
- Antes de producao, colocar rate limit/WAF na rota publica de onboarding.
- Nao expor raw contacts da lista comercial em resposta publica.
- Nao deletar dados legados por migration; quando a base real for iniciada,
  limpar ou arquivar dados por processo controlado, com backup.

## Proximas entregas relacionadas

1. Envio real de e-mail/SMS/WhatsApp para analise e verificacao.
2. Tela interna para aprovar/negar solicitacoes pendentes.
3. Criacao assistida do primeiro usuario administrador da empresa raiz.
4. Vinculo do usuario Firebase ao `tenantRootCompanyId`.
5. Enforcement de tenant em todos os services autenticados.
6. Personalizacao de calendario por empresa raiz com auditoria completa.
