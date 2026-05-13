# Sincronizacao Segura De Banco Real Para Local

Este fluxo serve para testar o back/front local com dados reais sem apontar o
ambiente local diretamente para producao.

## Regra principal

Nao rode o backend local conectado direto ao banco de producao com usuario de
escrita. Mesmo telas de consulta podem gerar escrita indireta, como refresh
tokens, `lastAccessAt`, eventos de seguranca, sessoes sensiveis e outbox de
notificacao.

O caminho seguro e:

1. Criar um usuario somente leitura no banco real.
2. Fazer dump da origem real.
3. Restaurar esse dump no MySQL local `127.0.0.1:3308/pariflow_partners`.
4. Rodar o back local contra esse banco local.

## Usuario de dump na origem

Restrinja o host/IP conforme sua infraestrutura. Evite `%` se puder liberar
apenas o IP de quem fara o dump.

```sql
CREATE USER 'pariflow_dump_readonly'@'%' IDENTIFIED BY 'troque-esta-senha';
GRANT SELECT, SHOW VIEW, TRIGGER, EVENT
ON pariflow_partners.*
TO 'pariflow_dump_readonly'@'%';
FLUSH PRIVILEGES;
```

## Configurar credenciais locais

Copie o exemplo e preencha sem commitar:

```powershell
Copy-Item .env.real.example .env.real.local
```

No `.env.real.local`, use somente variaveis `REAL_DB_*`.

Se as credenciais reais foram colocadas no `.env` do backend, o script tambem
consegue usar o `DATABASE_URL` desse arquivo como origem de dump:

```powershell
npm.cmd run db:sync:real-to-local -- -SourceEnvFile .env -ReplaceLocalDatabase
```

Nesse caso, nao suba o backend com `npm.cmd run dev`, porque ele carregaria o
`.env` diretamente. Use `dev:local-token`, que sobrescreve `DATABASE_URL` para o
MySQL local e desliga notificacoes por padrao.

## Ajustar o `.env` do backend local

Para testar com copia real restaurada localmente, mantenha o `DATABASE_URL`
apontando para o MySQL local e desligue seed de exemplo e notificacoes:

```dotenv
DATABASE_URL=mysql://pariflow_app:PariFlowLocal%212026@127.0.0.1:3308/pariflow_partners
DEV_AUTH_BYPASS=true
SEED_ENABLE_SAMPLE_DATA=false
NOTIFICATION_OUTBOX_WORKER_ENABLED=false
SMTP_USER=
SMTP_PASSWORD=
WHATSAPP_ACCESS_TOKEN=
```

## Sincronizar

O script exige confirmacao explicita porque ele substitui o banco local. Antes
de limpar o local, ele salva um backup em `.local/backups`.

```powershell
npm.cmd run db:sync:real-to-local -- -ReplaceLocalDatabase
```

O script nao escreve na origem real. Ele usa `mysqldump` na origem e `mysql` no
alvo local fixo.

Depois da restauracao:

```powershell
npm.cmd run prisma:migrate:status
npm.cmd run dev:local-token -- -SkipDatabaseSetup -SkipMigrations
```

O script `dev:local-token` desliga o worker de notificacoes por padrao. Para
testar notificacoes localmente, use `-EnableNotificationWorker` somente com
credenciais de sandbox.

Se o codigo local tiver migrations mais novas que o banco real, aplique somente
no clone local:

```powershell
npm.cmd run prisma:migrate:deploy
```

## Comandos que nao devem ser usados contra producao

Nao rode os comandos abaixo apontando `DATABASE_URL` para producao:

- `npm.cmd run prisma:migrate:dev`
- `npm.cmd run prisma:seed`
- qualquer script de reset/drop/import
- backend local com `NOTIFICATION_OUTBOX_WORKER_ENABLED=true` e credenciais reais
  de SMTP ou WhatsApp
