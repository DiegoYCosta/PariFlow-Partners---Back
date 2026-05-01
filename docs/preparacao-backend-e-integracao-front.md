# Preparacao do backend e integracao futura com o front

## 1. Objetivo deste documento

Este documento traduz o material base de `D:\DEV\flutter\JOTABE\DPPRO_JOTABE\Documentacao\index.html` para um plano tecnico de backend.

O foco aqui e:

- preparar o backend para nascer com boa governanca, auditoria e seguranca;
- viabilizar deploy inicial na Amazon com Apache como reverse proxy;
- desenhar contratos de API estaveis para um front que ainda sera construido;
- evitar acoplamento excessivo entre interface, regras de negocio e persistencia.

O produto continua seguindo a mesma premissa do documento-mestre: apoiar decisao executiva com historico, vinculos, ocorrencias, anexos sensiveis e trilha completa de auditoria.

## 2. Decisoes de arquitetura

### 2.1 Stack recomendada

Para o backend, a recomendacao e:

- `Node.js 22 LTS`
- `TypeScript`
- `NestJS` com `Fastify adapter`
- `Prisma ORM`
- `MySQL 8.4` no RDS para projeto novo
- `Firebase Auth` para autenticacao primaria
- `firebase-admin` no backend para validar o `Firebase ID Token`
- JWT interno para `access token`
- `refresh token` rotativo persistido no banco
- `Apache` como reverse proxy
- `PM2` para manter o processo Node em execucao
- `S3 privado` para anexos digitais

### 2.2 Por que essa combinacao

- `NestJS` ajuda a organizar modulos, guards, interceptors, Swagger/OpenAPI e regras de seguranca.
- `Fastify` melhora desempenho e reduz overhead HTTP.
- `Prisma` acelera modelagem inicial, migracoes e consistencia entre banco e codigo.
- `MySQL` esta alinhado ao desenho do documento base.
- `Firebase Auth` resolve login primario sem obrigar o backend a manter senha de usuario final desde o primeiro dia.
- `Apache` permite servir front estatico no mesmo host e encaminhar `/api` para o Node, simplificando cookies, CORS e deploy.

### 2.3 Regra de integracao principal

O backend deve ser `API-first`.

Isso significa:

- o contrato da API vem antes da tela final;
- o front consome contratos versionados;
- regras de permissao e visibilidade ficam no backend;
- o front nao decide seguranca, apenas respeita o que a API autoriza.

## 3. Topologia recomendada na Amazon

### 3.1 Topologia inicial

Para subir rapido sem perder qualidade:

```text
Usuario
  -> HTTPS
  -> Apache (EC2 Amazon Linux 2023)
  -> Node.js/NestJS em 127.0.0.1:3000
  -> RDS MySQL
  -> S3 privado
  -> Firebase Auth
```

### 3.2 Regra pratica de ambiente

- `Desenvolvimento local`: banco local ou container
- `Homologacao inicial`: EC2 + Apache + Node + RDS
- `Producao minima recomendada`: EC2 + Apache + Node + RDS + S3 privado + CloudWatch

### 3.3 Observacao importante sobre o banco

Mesmo que o primeiro rascunho possa rodar com MySQL na mesma maquina da aplicacao, a recomendacao para ambiente serio e usar `Amazon RDS for MySQL`.

Motivos:

- backup e snapshot nativos;
- operacao mais simples;
- opcao de Multi-AZ depois;
- menos risco de perder banco junto com a instancia da aplicacao.

Observacao de versao:

- para projeto novo, preferir `MySQL 8.4` no RDS;
- em `27/04/2026`, a documentacao da AWS lista o fim do suporte padrao do `MySQL 8.0` em `30/04/2026`, entao nao vale iniciar um sistema novo nessa linha.

## 4. Relacao com o front futuro

### 4.1 Diretriz principal

O front futuro deve consumir a API como contrato estavel, e nao como reflexo direto do banco.

A interface pode ser:

- `Flutter Web`, como sugerido no documento original; ou
- outra SPA web no futuro.

O backend deve continuar igual do ponto de vista de dominio e seguranca.

### 4.2 Melhor desenho para reduzir atrito

Se o front web for hospedado no mesmo servidor Apache, a melhor estrategia e:

- servir o front em `/`
- expor a API em `/api`

Exemplo:

- `https://painel.exemplo.com/` -> front
- `https://painel.exemplo.com/api/v1/...` -> backend

Isso reduz:

- problemas de CORS;
- complexidade de cookie seguro;
- divergencia entre ambientes;
- trabalho futuro no login e refresh de sessao.

### 4.3 O que o front nao deve assumir

O front nao deve:

- inferir permissao apenas por nome de cargo;
- montar URLs publicas de anexos;
- calcular sozinho se o usuario pode ver conteudo sensivel;
- depender de nomes internos de tabela;
- duplicar regra de negocio critica.

O front deve receber isso do backend em formato explicito.

## 5. Padrao de contrato da API

### 5.1 Versionamento

Toda rota publica da aplicacao deve nascer sob:

```text
/api/v1
```

Se houver quebra de contrato no futuro, sobe-se `v2` sem destruir o front anterior.

### 5.2 Padrao de resposta

Resposta de sucesso:

```json
{
  "data": {},
  "meta": {
    "traceId": "req_01..."
  }
}
```

Resposta de erro:

```json
{
  "error": {
    "code": "ACCESS_DENIED",
    "message": "Acesso negado para este recurso.",
    "details": [],
    "traceId": "req_01..."
  }
}
```

### 5.3 Regras tecnicas do contrato

- Datas em `ISO 8601` no backend.
- Timezone salvo de forma consistente no servidor; exibicao local fica com o front.
- Paginacao padrao com `page`, `perPage`, `total`, `totalPages`.
- Ordenacao padrao com `sort` e `order`.
- Busca textual padrao com `search`.
- Filtros por query string, sem inventar formatos diferentes por modulo.
- Todas as respostas criticas devem carregar `traceId`.

### 5.4 IDs expostos ao front

Para evitar exposicao de IDs sequenciais em URL:

- pode existir `id` interno no banco;
- a API deve preferir expor `publicId` para consumo externo.

Boa opcao:

- `bigint` interno para relacoes;
- `ULID` ou `UUID v7` como identificador publico.

## 6. Fluxo de autenticacao e sessao

### 6.1 Fluxo principal

```text
Front faz login no Firebase
  -> recebe Firebase ID Token
  -> chama POST /api/v1/auth/session/exchange
  -> backend valida token com firebase-admin
  -> backend localiza ou cria usuario_sistema
  -> backend carrega perfis e permissoes
  -> backend emite access token interno
  -> backend grava refresh token rotativo
```

### 6.2 Estrategia recomendada de sessao

Para web:

- `access token` curto, usado pelo front em memoria
- `refresh token` em cookie `httpOnly`, `secure`, com rotacao

Duracoes sugeridas:

- `access token`: 10 minutos
- `refresh token`: 7 a 30 dias
- `sensitive session`: 5 a 10 minutos

### 6.3 Step-up para area sensivel

Areas criticas devem exigir uma validacao extra, mesmo com usuario logado.

Exemplos:

- abrir anexo sensivel;
- baixar dossie;
- exportar relatorio juridico;
- excluir logicamente registro;
- restaurar anexo;
- visualizar documento classificado.

Estados minimos do contexto de seguranca:

- `authenticated`
- `privileged`
- `sensitive_verified`
- `critical_verified`

## 7. Modulos do backend

### 7.1 Modulos base

- `auth`
- `usuarios`
- `perfis-acesso`
- `empresas-prestadoras`
- `clientes-contratantes`
- `contratos`
- `servicos`
- `postos`
- `pessoas`
- `trabalhos-externos`
- `vinculos`
- `movimentacoes-vinculo`
- `desligamentos`
- `ocorrencias`
- `anexos`
- `recebimentos-documento`
- `auditoria`
- `security-events`
- `relatorios`
- `catalogos`

### 7.2 Estrutura sugerida do projeto

```text
src/
  app.module.ts
  main.ts
  config/
  common/
    decorators/
    guards/
    interceptors/
    filters/
    dto/
  modules/
    auth/
    users/
    access-profiles/
    companies/
    clients/
    contracts/
    services/
    positions/
    people/
    external-work/
    links/
    occurrences/
    attachments/
    audit/
    reports/
    catalogs/
  infra/
    firebase/
    storage/
    logger/
    queue/
  database/
prisma/
docs/
```

## 8. Modelo inicial de dados

### 8.1 Blocos de dominio

O banco deve seguir os blocos do documento base:

- contexto empresarial
- identificacao-base
- vinculos e historico
- dossie e anexos
- governanca e seguranca

### 8.2 Tabelas iniciais

#### Contexto empresarial

- `empresa_prestadora`
- `cliente_contratante`
- `contrato`
- `servico`
- `posto_ou_vaga`

#### Identificacao-base

- `pessoa`
- `trabalho_externo`
- `documento_identidade` se o projeto separar RG/CPF/RNM

#### Historico

- `vinculo`
- `movimentacao_vinculo`
- `desligamento`

#### Dossie

- `ocorrencia`
- `anexo`
- `recebimento_documento`

#### Governanca e seguranca

- `usuario_sistema`
- `perfil_acesso`
- `usuario_perfil_acesso`
- `refresh_tokens`
- `mfa_factors`
- `sensitive_sessions`
- `login_attempts`
- `security_events`
- `log_auditoria`
- `download_lote`
- `visualizacao_sensivel`

### 8.3 Regra de modelagem

Dados criticos nao devem ficar presos em JSON como fonte principal.

Devem ser estruturados:

- CPF
- datas
- status
- tipo de ocorrencia
- gravidade
- visibilidade
- relacoes entre pessoa, vinculo, empresa, contrato e anexo

JSON so deve complementar campos dinamicos ou metadados controlados.

### 8.4 Campos flexiveis

Se houver extensao controlada, usar:

- `campo_customizado`
- `valor_customizado`
- `tag_entidade`

No caso de `tag_entidade`, o uso deixa de ser abstrato e passa a ser este:

- anotar pessoa ou empresa prestadora com memoria operacional sensivel;
- aceitar submissao sem login no fluxo de entrada;
- exigir autenticacao para consulta;
- separar classificacoes como `BEHAVIORAL_SIGNAL`, `FAMILY_CONTEXT`, `TRAINING_OR_SKILL` e `OPERATIONAL_RISK`;
- limitar cada anotacao a `350` caracteres;
- preservar `label`, `color`, `sortOrder`, autoria autenticada quando houver e remocao logica auditavel;
- registrar `ownerUserPublicId`, `allowedGroupKeys` e `allowedUserPublicIds` como ACL explicita do conteudo;
- impedir que listagens genericas de pessoa ou empresa vazem contagem, existencia, titulo ou resumo de conteudo protegido quando a ACL nao puder ser calculada com seguranca.

Tambem fica definido desde ja que `anexo` passa a carregar `classification`, `ownerUserPublicId`, grupos compartilhados e pessoas compartilhadas, para separar documento formal de anexo sensivel e referencia de apoio sem misturar permissao na interface.

## 9. Rotas minimas do primeiro ciclo

### 9.1 Autenticacao

- `POST /api/v1/auth/session/exchange`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/sensitive-session/start`
- `POST /api/v1/auth/sensitive-session/verify`

### 9.2 Cadastros mestre

- `GET /api/v1/empresas-prestadoras`
- `POST /api/v1/empresas-prestadoras`
- `GET /api/v1/clientes`
- `POST /api/v1/clientes`
- `GET /api/v1/contratos`
- `POST /api/v1/contratos`
- `GET /api/v1/postos`
- `POST /api/v1/postos`

### 9.3 Pessoas e vinculos

- `GET /api/v1/pessoas`
- `POST /api/v1/pessoas`
- `GET /api/v1/pessoas/:publicId`
- `GET /api/v1/vinculos`
- `POST /api/v1/vinculos`
- `POST /api/v1/vinculos/:publicId/movimentacoes`
- `POST /api/v1/vinculos/:publicId/desligamento`

### 9.4 Dossie e anexos

- `GET /api/v1/ocorrencias`
- `POST /api/v1/ocorrencias`
- `GET /api/v1/ocorrencias/:publicId`
- `POST /api/v1/ocorrencias/:publicId/anexos`
- `POST /api/v1/anexos/:publicId/request-access`
- `GET /api/v1/anexos/:publicId/download`
- `POST /api/v1/anexos/:publicId/soft-delete`

### 9.5 Tags sensiveis por entidade

- `POST /api/v1/tags-entidade/submissions`
- `POST /api/v1/tags-entidade`
- `GET /api/v1/tags-entidade?targetType=PERSON&targetPublicId=...`
- `GET /api/v1/tags-entidade/:publicId`
- `PATCH /api/v1/tags-entidade/:publicId`
- `DELETE /api/v1/tags-entidade/:publicId`

Regras minimas:

- `submissions` aceita entrada anonima controlada, mas ja precisa carregar `ownerUserPublicId` e ACL explicita;
- `GET` exige usuario autenticado e so pode devolver o que estiver compartilhado com a autoria, com um grupo permitido ou com um colaborador especifico;
- `POST`, `PATCH` e `DELETE` internos exigem usuario autenticado; gestao fica restrita a autoria ou a override privilegiado auditavel;
- listagem e detalhe continuam trabalhando com `publicId` do alvo;
- sem contexto autenticado autorizado, a API nao devolve contagem, existencia, titulo ou resumo de conteudo protegido.

### 9.6 Anexos protegidos

- `GET /api/v1/anexos?occurrencePublicId=...`
- `GET /api/v1/anexos/:publicId`
- `POST /api/v1/anexos/submissions`
- `POST /api/v1/anexos`
- `PATCH /api/v1/anexos/:publicId`
- `DELETE /api/v1/anexos/:publicId`

Regras minimas:

- anexos protegidos seguem `ownerUserPublicId`, `allowedGroupKeys` e `allowedUserPublicIds`;
- leitura e download exigem usuario autenticado e passam por ACL por conteudo;
- sem login, o sistema nao revela quantidade, existencia, titulo nem resumo de material protegido;
- a mesma politica vale para documento formal, anexo sensivel e referencia de apoio.

### 9.7 Auditoria e relatorios

- `GET /api/v1/auditoria`
- `GET /api/v1/relatorios/painel-executivo`
- `GET /api/v1/relatorios/mapa-riscos`
- `GET /api/v1/relatorios/historico-acesso`

## 10. Regras de integracao importantes para o front

### 10.1 Endpoint de bootstrap de sessao

Logo apos login, o front deve chamar um endpoint que devolva:

- usuario autenticado;
- perfis;
- permissoes efetivas;
- modulos habilitados;
- contexto de seguranca atual;
- configuracoes basicas de catalogo.

Exemplo:

```json
{
  "data": {
    "user": {
      "publicId": "usr_01...",
      "nome": "Usuario Interno",
      "email": "usuario@empresa.com"
    },
    "securityContext": "authenticated",
    "profiles": ["juridico"],
    "audienceGroups": ["SUPERVISION"],
    "capabilities": {
      "canViewSensitive": true,
      "canDownloadAttachments": false,
      "canSoftDeleteAttachment": false
    }
  }
}
```

Isso reduz regra duplicada no front.

### 10.2 Catalogos e enums

O front nao deve hardcodar toda a semantica do sistema.

Criar endpoints de catalogo para:

- tipos de ocorrencia;
- niveis de gravidade;
- visibilidades;
- classificacoes de anexo;
- classificacoes de tag sensivel;
- grupos de compartilhamento sensivel;
- status de vinculo;
- perfis de acesso;
- tipos de desligamento;
- filtros padrao de relatorio.

### 10.3 Paginacao e filtros

Todos os modulos de lista devem seguir um padrao previsivel.

Exemplo:

```text
GET /api/v1/ocorrencias?empresaId=...&pessoaId=...&natureza=negativa&page=1&perPage=20&sort=dataOcorrencia&order=desc
```

### 10.4 Uploads

No primeiro ciclo, o front deve enviar arquivos para a API, e nao direto para o bucket.

Motivo:

- permite validar permissao antes do upload;
- gera auditoria desde a entrada;
- simplifica regra de versao;
- reduz risco de arquivo solto sem vinculo funcional.

Se o volume crescer depois, pode-se evoluir para upload assinado, mas ainda mediado por endpoint de autorizacao.

### 10.5 Download de anexos

O front nunca recebe URL publica fixa de arquivo sensivel.

Fluxo recomendado:

```text
Front pede acesso
  -> backend valida contexto e step-up
  -> backend audita
  -> backend faz stream do arquivo
  ou
  -> backend gera URL temporaria de curtissima duracao
```

## 11. Seguranca, auditoria e LGPD

### 11.1 Regras obrigatorias

- exclusao logica para entidades sensiveis;
- auditoria de criacao, edicao, visualizacao, download, exportacao e exclusao;
- mascaramento parcial em telas nao criticas;
- criptografia em transito e em repouso;
- perfis e permissoes por papel;
- ACL por autoria, grupos e pessoas especificas para cada tag sensivel e cada anexo protegido;
- nenhuma resposta anonima ou sem ACL validada pode denunciar existencia de conteudo protegido;
- confirmacao reforcada para conteudo altamente sensivel.

### 11.2 O que precisa ser auditado

- login, logout e falha de login;
- troca e renovacao de token;
- elevacao para `sensitive_verified`;
- abertura de documento sensivel;
- download e exportacao;
- criacao e alteracao de ocorrencia;
- upload e exclusao logica de anexo;
- alteracao de ACL de tag sensivel ou anexo protegido;
- tentativa negada de leitura, download, edicao ou remocao de conteudo sensivel;
- acessos negados.

### 11.3 Estrategia de exclusao

Evitar exclusao fisica no fluxo comum.

Preferir:

- `status = excluido`
- `deleted_at`
- `deleted_by`
- `delete_reason`

## 12. Infraestrutura AWS + Apache

### 12.1 Composicao minima

- `EC2 Amazon Linux 2023`
- `Apache httpd`
- `Node.js` rodando em `127.0.0.1:3000`
- `PM2`
- `Amazon RDS for MySQL`
- `Amazon S3` privado para anexos
- `Security Groups`
- `Route 53` para DNS, se o dominio estiver na AWS

### 12.2 Modulos Apache necessarios

- `proxy`
- `proxy_http`
- `headers`
- `ssl`
- `rewrite` se houver necessidade de SPA fallback extra

### 12.3 Exemplo de vhost

```apache
<VirtualHost *:80>
  ServerName painel.exemplo.com
  Redirect permanent / https://painel.exemplo.com/
</VirtualHost>

<VirtualHost *:443>
  ServerName painel.exemplo.com

  SSLEngine on
  SSLCertificateFile /etc/ssl/certs/painel.crt
  SSLCertificateKeyFile /etc/ssl/private/painel.key

  ProxyPreserveHost On
  RequestHeader set X-Forwarded-Proto "https"
  RequestHeader set X-Forwarded-Port "443"

  ProxyPass /api http://127.0.0.1:3000/api
  ProxyPassReverse /api http://127.0.0.1:3000/api

  ProxyPass /health http://127.0.0.1:3000/health
  ProxyPassReverse /health http://127.0.0.1:3000/health

  DocumentRoot /var/www/pariflow-front

  <Directory /var/www/pariflow-front>
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
    FallbackResource /index.html
  </Directory>
</VirtualHost>
```

### 12.4 Regras de rede

Inbound no EC2:

- `22` apenas para IPs autorizados
- `80` publico apenas para redirect
- `443` publico

Banco:

- acesso apenas do security group da aplicacao
- nunca expor MySQL publicamente sem necessidade real

### 12.5 Processo Node

Subir a API com `PM2` e manter porta interna privada:

- Node escutando em `127.0.0.1:3000`
- Apache exposto publicamente
- sem acesso direto externo ao processo Node

### 12.6 Sequencia recomendada para preparar o servidor

1. Criar a instancia `EC2` com `Amazon Linux 2023`.
2. Configurar `Security Group` com portas `22`, `80` e `443`.
3. Instalar e habilitar o `Apache httpd`.
4. Instalar o runtime do `Node.js 22 LTS`.
5. Publicar o backend em uma pasta dedicada, como `/srv/pariflow/back`.
6. Configurar variaveis de ambiente do backend.
7. Instalar dependencias e subir a API com `PM2`.
8. Validar que a API responde localmente em `127.0.0.1:3000`.
9. Criar o `VirtualHost` do Apache para servir o front e fazer proxy de `/api`.
10. Configurar `TLS` no dominio final.
11. Publicar o build do front em `/var/www/pariflow-front` quando ele existir.
12. Testar `https://dominio/health` e `https://dominio/api/v1/...`.

## 13. Variaveis de ambiente minimas

```text
NODE_ENV=production
PORT=3000
APP_NAME=pariflow-back
APP_URL=https://painel.exemplo.com
API_PREFIX=api/v1
DATABASE_URL=mysql://user:pass@host:3306/dbname
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_TTL_MINUTES=10
JWT_REFRESH_TTL_DAYS=15
COOKIE_DOMAIN=painel.exemplo.com
COOKIE_SECURE=true
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
AWS_REGION=sa-east-1
S3_BUCKET_PRIVATE=...
SENSITIVE_SESSION_TTL_MINUTES=10
LOG_LEVEL=info
```

## 14. Roadmap recomendado

### Fase 1. Fundacao tecnica

- criar projeto Node/NestJS/TypeScript
- configurar Prisma
- configurar MySQL
- configurar lint, format, testes e `.env`
- configurar logger e `traceId`

### Fase 2. Identidade e seguranca

- integrar Firebase Admin
- criar exchange de sessao
- criar refresh token rotativo
- criar guards, roles e `security context`
- criar auditoria basica

### Fase 3. Cadastros mestre

- empresa prestadora
- cliente contratante
- contrato
- servico
- posto ou vaga
- pessoa

### Fase 4. Vinculos e historico

- vinculo
- movimentacao de vinculo
- desligamento
- filtros multiempresa

### Fase 5. Dossie e anexos

- ocorrencia
- anexo
- versionamento
- exclusao logica
- controle de acesso sensivel

### Fase 6. Relatorios e painel executivo

- painel consolidado
- mapa de riscos
- historico de acesso
- downloads auditados

### Fase 7. Contrato estavel para o front

- publicar OpenAPI
- gerar cliente para o front
- congelar formatos de erro, filtros e bootstrap de sessao
- criar ambiente de homologacao integrado

## 15. Checklist antes de iniciar o codigo

- fechar nomes oficiais das entidades
- fechar perfis e permissoes
- fechar tipos de ocorrencia
- fechar regras de visibilidade e anexos sensiveis
- decidir se o primeiro front sera mesmo `Flutter Web`
- definir dominio principal e estrategia `/api`
- decidir se o banco inicial ja nasce em `RDS`
- decidir bucket e politica de anexos

## 16. Decisao recomendada para este projeto

Se o objetivo e montar uma base boa desde o inicio, a recomendacao pratica e esta:

- backend em `NestJS + Fastify + Prisma + MySQL 8.4`
- autenticacao primaria em `Firebase Auth`
- autorizacao, auditoria e sessao sensivel controladas no backend
- deploy em `EC2 Amazon Linux 2023`
- `Apache` servindo o front em `/` e fazendo proxy de `/api`
- `RDS MySQL` para banco
- `S3 privado` para anexos
- API versionada e documentada em `OpenAPI`

Esse desenho atende o documento-mestre, reduz retrabalho e deixa o front futuro livre para evoluir sem quebrar o dominio do sistema.

## 17. Referencias usadas para este plano

- Documento base local: `D:\DEV\flutter\JOTABE\DPPRO_JOTABE\Documentacao\index.html`
- Documento tecnico segmentado local:
  - `D:\DEV\flutter\JOTABE\DPPRO_JOTABE\Documentacao\segmentado\tecnico\arquitetura-e-modelagem.html`
  - `D:\DEV\flutter\JOTABE\DPPRO_JOTABE\Documentacao\segmentado\tecnico\autenticacao-e-sessoes.html`
  - `D:\DEV\flutter\JOTABE\DPPRO_JOTABE\Documentacao\segmentado\tecnico\seguranca-e-infraestrutura.html`
- Referencias oficiais validadas:
  - AWS Amazon Linux 2023 LAMP/Apache: `https://docs.aws.amazon.com/linux/al2023/ug/ec2-lamp-amazon-linux-2023.html`
  - AWS SSL/TLS no AL2023: `https://docs.aws.amazon.com/linux/al2023/ug/SSL-on-amazon-linux-2023.html`
  - AWS EC2 Security Groups: `https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html`
  - AWS RDS for MySQL: `https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_MySQL.html`
  - AWS versoes do RDS MySQL: `https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/MySQL.Concepts.VersionMgmt.html`
  - Firebase verify ID tokens: `https://firebase.google.com/docs/auth/admin/verify-id-tokens`
  - Apache reverse proxy guide: `https://httpd.apache.org/docs/2.4/howto/reverse_proxy.html`
