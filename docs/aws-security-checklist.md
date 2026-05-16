# AWS Security Checklist

Data de referencia: `2026-05-14`.

Este material fica no backend porque os controles criticos estao na API, no
Apache, no MySQL, no PM2 e nas variaveis de ambiente. O front so precisa mudar
quando a API nao estiver no mesmo host, usando
`--dart-define=PARIFLOW_API_BASE_URL=https://pariflowpartners.com.br/api/v1`.

## Modos de deploy

### Homologacao por IP

Uso: validacao curta e controlada.

- `APP_URL=http://3.18.213.49`
- `CORS_ORIGINS=http://3.18.213.49`
- `COOKIE_SECURE=true` ja fica ativo para nao abrir excecao de refresh em
  ambiente publico. Enquanto o acesso estiver por HTTP/IP, o navegador nao deve
  persistir o cookie `Secure`; validar sessao longa so depois de HTTPS.
- `PREVIEW_AUTH_BYPASS=false`
- `DEV_AUTH_BYPASS=false`
- `SWAGGER_ENABLED=false`
- `PUBLIC_SUBMISSIONS_ENABLED=false`
- `SEED_ENABLE_SAMPLE_DATA=false`
- JWT secrets nao podem usar `change-this-*`.
- `dev-token` nao deve ser aceito em IP publico.
- Security Group com SSH restrito ao seu IP.
- Nunca abrir `3000`, `3001`, `3306` ou `33060` publicamente.

### Producao publica

Use somente depois de dominio, HTTPS e Firebase Admin configurados.

- `APP_URL=https://pariflowpartners.com.br`
- `CORS_ORIGINS=https://pariflowpartners.com.br,https://www.pariflowpartners.com.br`
- `COOKIE_SECURE=true`
- `TRUST_PROXY=true`
- `PREVIEW_AUTH_BYPASS=false`
- `DEV_AUTH_BYPASS=false`
- `SWAGGER_ENABLED=false`
- `SEED_ENABLE_SAMPLE_DATA=false`
- Firebase Admin preenchido.
- S3 privado e URL assinada curta quando anexos reais forem ativados.
- SMTP/SES/WhatsApp sem credenciais no Git.
- Refresh token em cookie `HttpOnly` no mesmo dominio da API/front.
- Refresh token guarda `tenantRootCompanyId` selecionado; a troca de empresa
  exige `POST /api/v1/auth/company-context` e vinculo ativo em
  `usuario_empresa_raiz_acesso`.
- Swagger fechado fora de ambiente controlado.
- `npm ci --omit=optional` no deploy enquanto Firestore/Storage opcionais do
  Firebase Admin nao forem usados.

## Security Group

Entrada publica recomendada:

| Porta | Origem | Motivo |
| --- | --- | --- |
| 22 | Seu IP fixo | SSH administrativo |
| 80 | `0.0.0.0/0` | HTTP inicial ou redirect |
| 443 | `0.0.0.0/0` | HTTPS publico |

Nao abrir publicamente:

| Porta | Motivo |
| --- | --- |
| 3000 | Front fica atras do Apache |
| 3001 | API fica atras do Apache |
| 3306 | MySQL deve aceitar apenas local |
| 33060 | MySQL X Plugin nao deve ser publico |

## DNS do dominio

Estado observado em 2026-05-15:

- `pariflowpartners.com.br` usa os nameservers `dns3.hostgator.com.br` e
  `dns4.hostgator.com.br`.
- O registro `A` do dominio raiz resolve para `162.240.81.81`.
- A EC2 atual resolve para `3.18.213.49`.

Antes de emitir HTTPS, escolha uma das rotas:

- manter DNS na HostGator e trocar o registro `A` de
  `pariflowpartners.com.br` para o Elastic IP da EC2;
- ou criar uma hosted zone no Route 53, atualizar os nameservers no registrador
  e criar os registros `A/AAAA` ou alias para a infra AWS.

Para EC2 direta, associe um Elastic IP antes de apontar o DNS. O IP publico
padrao da instancia pode mudar em stop/start.

## Baseline historico da EC2

Registro consolidado do relatorio externo de preparacao da instancia em
2026-05-04. Use como contexto historico, nao como substituto do smoke atual.

| Item | Valor observado |
| --- | --- |
| Sistema | Amazon Linux 2023 |
| Usuario | `ec2-user` |
| IP publico usado | `3.18.213.49` |
| Apache | `Apache/2.4.66 (Amazon Linux)` |
| Node.js | `v22.22.2` |
| npm | `10.9.7` |
| PM2 | `7.0.1` |
| MySQL | `8.4.9` Community Server |

Arquitetura alvo desse baseline: uma unica EC2 com Apache, backend, front,
MySQL e PM2, sem Docker. O Apache respondeu na porta 80 e o MySQL estava ativo,
mas front/back ainda dependiam do deploy de aplicacao.

## Apache e PM2

`apache/pariflow-back.conf.example` deve expor somente `/`, `/api` e `/health`.

- `/` -> front em `127.0.0.1:3000`
- `/api` -> back em `127.0.0.1:3001`
- `/health` -> back em `127.0.0.1:3001`
- `/api/docs` deve responder `404` em producao/homologacao publica.

Validacao:

```bash
sudo apachectl configtest
sudo systemctl restart httpd
curl -I https://pariflowpartners.com.br/health/live
pm2 list
sudo ss -tulpn | grep -E ':3000|:3001|:3306'
```

Resultado esperado para processos internos:

```text
127.0.0.1:3000
127.0.0.1:3001
127.0.0.1:3306
```

## Secrets e ambiente

Gerar JWT secrets fortes:

```bash
openssl rand -base64 48
```

Checar variaveis sem mostrar valores:

```bash
for key in NODE_ENV HOST PORT APP_URL CORS_ORIGINS COOKIE_SECURE PREVIEW_AUTH_BYPASS DEV_AUTH_BYPASS SWAGGER_ENABLED PUBLIC_SUBMISSIONS_ENABLED DB_HOST DB_NAME FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_PRIVATE_KEY S3_BUCKET_PRIVATE SMTP_HOST SMTP_USER WHATSAPP_PHONE_NUMBER_ID; do
  value="$(grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2-)"
  if [ -n "$value" ]; then echo "$key=set"; else echo "$key=empty"; fi
done
```

Aplicar Firebase Admin na EC2 sem imprimir private key:

```powershell
cd "D:\DEV\flutter\JOTABE\PariFlow Partners - Back"
.\scripts\apply-firebase-admin-aws.ps1 -ServiceAccountJson "C:\caminho\service-account.json"
.\scripts\grant-admin-aws.ps1 -Email "admin@empresa.com" -FirebaseUid "uid" -Name "Administrador"
```

## Smoke test

```bash
BASE_URL=http://3.18.213.49 EXPECT_PREVIEW_BYPASS=false bash scripts/smoke-aws-security.sh
```

Para producao publica:

```bash
BASE_URL=https://pariflowpartners.com.br EXPECT_PREVIEW_BYPASS=false bash scripts/smoke-aws-security.sh
```

O caminho `EXPECT_PREVIEW_BYPASS=true` existe apenas para validar o fluxo local
iniciado por `npm run dev:local-token` contra loopback.

## Criterios minimos para ir online

- `npm run lint` e `npm run build` passam.
- `npm run prisma:migrate:deploy` passa na EC2.
- `npm run prisma:seed` cria perfis base sem duplicidade.
- `/health/live` e `/health/ready` respondem `200`.
- rota protegida sem Bearer responde `401`.
- fora de localhost/loopback, `dev-token` nao gera sessao.
- `/api/docs` nao responde em producao.
- MySQL esta preso a loopback.
- Security Group nao expoe `3000`, `3001`, `3306`, `33060`.
- Worker de notificacao nao duplica envios.
- `auth/refresh` renova sessao e `auth/logout` revoga refresh.
- Anexo sensivel exige step-up antes de download auditavel por URL assinada.

## Levantamento de riscos de seguranca

Riscos tratados neste corte:

- usuario Firebase com multiplas empresas agora seleciona somente uma empresa
  raiz ativa por sessao;
- o tenant operacional vem de JWT assinado pelo backend, nao de URL, query,
  cookie editavel ou estado local do front;
- o endpoint `auth/company-context` valida `usuario_empresa_raiz_acesso` antes
  de emitir access token e refresh token escopados;
- usuarios sem vinculo aprovado ficam restritos a `auth/access-context` e
  `auth/access-request`, vendo apenas documentos da propria solicitacao;
- refresh tokens rotacionados preservam o tenant selecionado no banco.

Riscos ainda abertos:

- DNS/HTTPS ainda precisa fechar para o cookie `Secure` funcionar de ponta a
  ponta no navegador;
- WAF/Captcha/rate limit externo ainda precisa proteger onboarding publico e
  solicitacoes de vinculo;
- aprovacao operacional de novos vinculos precisa rotina administrativa clara,
  com evidencia de quem aprovou e qual perfil foi concedido;
- backup/restore do MySQL ainda precisa rotina testada;
- smoke de login real deve cobrir troca de empresa, tentativa de tenant forjado
  e refresh de sessao longa.
