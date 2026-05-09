# AWS Security Checklist

Este material fica no backend porque os controles criticos de seguranca estao
na API, no Apache, no MySQL, no PM2 e nas variaveis de ambiente. O front so
precisa mudar quando a API nao estiver no mesmo host, usando
`--dart-define=PARIFLOW_API_BASE_URL=https://dominio/api/v1`.

## Modos de deploy

### Preview privado por IP

Use somente para homologacao curta e controlada. Estado atual verificado em
`2026-05-08`: front abre por HTTP no IP, `/health/live` responde, rotas
protegidas sem token retornam `401`, `dev-token` nao gera sessao em host
publico e `/api/docs` retorna `404`.

- `APP_URL=http://3.18.213.49`
- `CORS_ORIGINS=http://3.18.213.49`
- `COOKIE_SECURE=false`, porque ainda nao ha HTTPS.
- `PREVIEW_AUTH_BYPASS=false`
- `DEV_AUTH_BYPASS=false`
- `SWAGGER_ENABLED=false`
- `PUBLIC_SUBMISSIONS_ENABLED=false`
- `dev-token` nao deve ser aceito em IP publico; use Firebase Admin e usuario
  real tambem na homologacao por IP.
- Security Group com SSH restrito ao seu IP.
- Nunca abrir `3000`, `3001`, `3306` ou `33060` publicamente.
- `SEED_ENABLE_SAMPLE_DATA=false`
- JWT secrets nao podem usar `change-this-*`.

Arquivo local recomendado: `.env.aws.preview`, ignorado pelo Git. Na EC2, o
conteudo final deve ficar em `.env` no diretorio do backend.

### Producao publica

Use somente depois de dominio, HTTPS e Firebase Admin configurados.

- `APP_URL=https://seu-dominio`
- `CORS_ORIGINS=https://seu-dominio`
- `COOKIE_SECURE=true`
- `PREVIEW_AUTH_BYPASS=false`
- `DEV_AUTH_BYPASS=false`
- `SWAGGER_ENABLED=false`
- `SEED_ENABLE_SAMPLE_DATA=false`
- Firebase Admin preenchido.
- Bucket S3 privado preenchido quando anexos reais forem ativados.
- Swagger desabilitado no NestJS. Se precisar reabrir futuramente, publicar
  somente atras de protecao explicita.
- `npm ci --omit=optional` no deploy para nao instalar Firestore/Storage
  opcionais do Firebase Admin enquanto o backend usa somente Firebase Auth.

Arquivo local recomendado: `.env.aws.production`, ignorado pelo Git. Nao
promover preview para producao sem dominio, HTTPS, Firebase Admin e bypass
desligado.

## Security Group

Entrada publica recomendada:

| Porta | Origem | Motivo |
| --- | --- | --- |
| 22 | Seu IP fixo | SSH administrativo |
| 80 | `0.0.0.0/0` | HTTP inicial ou redirect para HTTPS |
| 443 | `0.0.0.0/0` | HTTPS publico |

Nao abrir publicamente:

| Porta | Motivo |
| --- | --- |
| 3000 | Front deve ficar atras do Apache |
| 3001 | API deve ficar atras do Apache |
| 3306 | MySQL deve aceitar apenas conexao local |
| 33060 | MySQL X Plugin nao deve ser publico |

## MySQL local

Prender o MySQL no loopback:

```bash
sudo cp /etc/my.cnf /etc/my.cnf.bak.$(date +%Y%m%d%H%M%S)
sudo nano /etc/my.cnf
```

Dentro de `[mysqld]`, adicionar ou ajustar:

```ini
bind-address=127.0.0.1
```

Depois reiniciar:

```bash
sudo systemctl restart mysqld
sudo ss -tulpn | grep 3306
```

Resultado esperado:

```text
127.0.0.1:3306
```

O usuario da aplicacao deve existir apenas para `localhost` e `127.0.0.1`.
Nao versionar `.env`, chaves Firebase, `.pem` ou dumps do banco.

## Apache

Usar `apache/pariflow-back.conf.example` como base para:

- expor somente `/`, `/api` e `/health`;
- apontar `/api` para `127.0.0.1:3001`;
- apontar `/` para `127.0.0.1:3000`;
- enviar headers basicos de seguranca;
- confirmar que `/api/docs` nao responde em producao.

Validacao:

```bash
sudo apachectl configtest
sudo systemctl restart httpd
curl -I http://3.18.213.49/health/live
```

## PM2

Depois de buildar e iniciar os apps:

```bash
pm2 list
pm2 save
pm2 startup
```

Os processos devem rodar em loopback:

```bash
sudo ss -tulpn | grep -E ':3000|:3001'
```

Resultado esperado:

```text
127.0.0.1:3000
127.0.0.1:3001
```

## Secrets e ambiente

Gerar JWT secrets fortes:

```bash
openssl rand -base64 48
```

Checar variaveis sem mostrar valores:

```bash
for key in NODE_ENV HOST PORT APP_URL CORS_ORIGINS COOKIE_SECURE PREVIEW_AUTH_BYPASS DEV_AUTH_BYPASS SWAGGER_ENABLED PUBLIC_SUBMISSIONS_ENABLED DB_HOST DB_NAME FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_PRIVATE_KEY S3_BUCKET_PRIVATE; do
  value="$(grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2-)"
  if [ -n "$value" ]; then echo "$key=set"; else echo "$key=empty"; fi
done
```

Valores esperados em producao publica:

- `NODE_ENV=production`
- `HOST=127.0.0.1`
- `PORT=3001`
- `TRUST_PROXY=true`
- `COOKIE_SECURE=true`
- `PREVIEW_AUTH_BYPASS=false`
- `DEV_AUTH_BYPASS=false`
- `SWAGGER_ENABLED=false`
- `PUBLIC_SUBMISSIONS_ENABLED=false`

Aplicar Firebase Admin na EC2 a partir da maquina Windows, sem imprimir a
private key:

```powershell
cd "D:\DEV\flutter\JOTABE\PariFlow Partners - Back"
.\scripts\apply-firebase-admin-aws.ps1 -ServiceAccountJson "C:\caminho\service-account.json"
.\scripts\grant-admin-aws.ps1 -Email "admin@empresa.com" -FirebaseUid "uid" -Name "Administrador"
```

Estado verificado em 2026-05-08: `FIREBASE_PROJECT_ID=set`,
`FIREBASE_CLIENT_EMAIL=set` e `FIREBASE_PRIVATE_KEY=set`, sem exibir valores.
Ainda faltam usuario real, perfil interno e smoke de login real ponta a ponta.

## Smoke test

Rodar na EC2 ou da sua maquina contra AWS/IP publico:

```bash
BASE_URL=http://3.18.213.49 EXPECT_PREVIEW_BYPASS=false bash scripts/smoke-aws-security.sh
```

Para producao publica, o mesmo teste deve continuar recusando `dev-token`:

```bash
BASE_URL=https://seu-dominio EXPECT_PREVIEW_BYPASS=false bash scripts/smoke-aws-security.sh
```

O caminho com `EXPECT_PREVIEW_BYPASS=true` existe apenas para validar o fluxo
local iniciado por `npm run dev:local-token`, por exemplo:

```bash
BASE_URL=http://127.0.0.1:3000 EXPECT_PREVIEW_BYPASS=true bash scripts/smoke-aws-security.sh
```

## Criterios minimos para ir online

- `npm run lint` e `npm run build` passam.
- `npm run prisma:migrate:deploy` passa na EC2.
- `npm run prisma:seed` cria perfis base sem duplicidade.
- `/health/live` responde `200`.
- `/health/ready` responde `200`.
- rota interna sem Bearer responde `401`.
- fora de localhost/loopback, `dev-token` nao gera sessao.
- `/api/docs` nao responde em producao.
- MySQL esta em `127.0.0.1:3306`.
- Security Group nao expoe `3000`, `3001`, `3306`, `33060`.
