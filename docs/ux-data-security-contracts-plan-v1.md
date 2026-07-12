# Plano Tecnico UX v1 - Backend, Banco e Seguranca

Data de referencia: `2026-07-12`.

Status: planejamento tecnico. Este documento descreve contratos e migracoes
necessarios para sustentar a especificacao UX/IA v1. Nada aqui deve ser tratado
como endpoint implementado ate existir codigo, migracao e validacao.

Documento front relacionado:
`D:\DEV\flutter\JOTABE\PariFlow Partners - Front\docs\ux-implementation-master-plan-v1.md`.

## Regras de autoridade

- O tenant operacional vem do JWT interno emitido pelo backend.
- O front nunca envia tenant como autoridade.
- Relacoes externas usam `publicId`.
- Mudancas precisam ser aditivas quando houver consumidor online.
- Chave omitida em `PATCH` preserva valor.
- Dado sensivel sem permissao nao revela titulo, resumo, quantidade ou contexto.
- Soft delete/inativacao prevalece quando historico ou auditoria importam.
- Swagger pode documentar endpoints, mas producao segue `SWAGGER_ENABLED=false`.

## Contratos backend planejados

### Focus Board Notes

Contrato detalhado: `docs/focus-board-notes-contract.md`.

Resumo:

- modulo novo `focus-board`;
- base `/api/v1/focus-board/notes`;
- tabelas novas para nota, participantes, contextos, eventos e lembretes;
- ACL propria por owner, usuario, perfil e grupo;
- auditoria propria e `AuditLog`;
- migracao manual/idempotente das notas locais do front;
- anexos diretos ficam fora da primeira fase se `Attachment` nao for
  generalizado.

### Busca global

Status atual: campo visual no header do front. Contrato backend planejado.

Endpoint proposto:

`GET /api/v1/search`

Query:

- `q`: string obrigatoria, 2 a 80 caracteres apos trim;
- `types`: CSV opcional com `people,provider_companies,client_companies,contracts,positions`;
- `limit`: 1 a 10 por grupo;
- `includeInactive`: boolean opcional, default `false`.

Resposta:

```json
{
  "data": {
    "groups": [
      {
        "type": "people",
        "label": "Pessoas",
        "items": [
          {
            "publicId": "pes_...",
            "title": "Joao Silva",
            "subtitle": "Analista DP",
            "context": "Tech Solutions LTDA / Contrato X",
            "routeTarget": {
              "workspace": "people",
              "publicId": "pes_..."
            },
            "badges": ["Ativo"]
          }
        ]
      }
    ]
  },
  "meta": {
    "query": "joao",
    "authorizedTotal": 1
  }
}
```

Regras:

- `authorizedTotal` soma somente itens visiveis.
- Nao retornar grupo vazio por falta de permissao sensivel se isso revelar
  existencia de dado bloqueado.
- CPF, documento, telefone e email devem ser mascarados ou omitidos conforme
  capability.
- Busca nao aceita tenant em query.
- Cada item precisa abrir uma origem canonica, nao uma tela duplicada.

Fase inicial recomendada:

- people por nome, matricula e identificadores permitidos;
- companies/clients/contracts por nome/documento/publicId;
- sem buscar conteudo de notas privadas;
- sem historico recente de pesquisa.

### Home de triagem diaria

Status atual: `GET /api/v1/dashboard/home` existe. Evolucao deve ser aditiva.

Contrato planejado:

`GET /api/v1/dashboard/home` pode receber campos novos em `data.triage` sem
quebrar consumidores atuais.

Campos planejados:

```json
{
  "data": {
    "triage": {
      "today": "2026-07-12",
      "priorities": [],
      "upcomingDeadlines": [],
      "resumeItems": [],
      "immediateAgenda": []
    }
  }
}
```

Item padrao:

```json
{
  "publicId": "tri_...",
  "kind": "calendar_entry",
  "title": "Retorno de ferias",
  "subjectPublicId": "pes_...",
  "subjectType": "person",
  "subjectLabel": "Ana Paula Oliveira",
  "dueAt": "2026-07-12T09:00:00-03:00",
  "severity": "attention",
  "action": {
    "label": "Abrir origem",
    "workspace": "timeline",
    "publicId": "agi_..."
  }
}
```

Regras:

- maximo recomendado de 5 itens por grupo para a Home;
- item sem permissao nao entra no payload;
- prazos calculados por dominio, nao pelo front;
- Focus Board entra apenas apos contrato de notas implementado;
- ferias/afastamentos e contrato de experiencia so entram quando houver modelo
  de dominio validado.

### Documentos e anexos

Status atual: `Attachment` pertence a `Occurrence`.

Evolucao planejada:

- fase curta: manter anexos formais na origem existente;
- fase futura: generalizar dono de anexo para nota, contrato, pessoa ou evento;
- regra "exatamente um dono" no service;
- reutilizar step-up, URL assinada e auditoria.

Nao fazer:

- criar ocorrencia falsa para guardar anexo de nota;
- copiar anexo entre dominios sem referencia auditavel;
- reduzir ACL de anexos para facilitar UI.

### Ferias, afastamentos e contrato de experiencia

Status: dominio pendente.

Diretriz:

- nao modelar como simples agenda;
- nao modelar como ocorrencia generica;
- backend deve definir status, periodo, documentos, aprovacao, responsavel,
  calculos e eventos refletidos;
- front apenas exibe prazos e estados calculados.

## Plano de banco de dados

### Fase DB1 - Focus Board sem anexos

Migracoes:

- enums de Focus Board;
- `focus_board_note`;
- `focus_board_note_participant`;
- `focus_board_note_context`;
- `focus_board_note_event`;
- `focus_board_note_reminder`;
- indices por tenant, status, owner, dueAt e thread;
- FK para `UserSystem`, `AccessProfile`, entidades de contexto e
  `CalendarEntry`.

Rollback:

- como e modulo novo, rollback pode remover tabelas se nao houver dados
  migrados;
- apos migracao de usuario real, rollback deve preservar tabelas e desativar
  endpoints por feature flag, nao dropar dados.

### Fase DB2 - Busca global

Sem tabela obrigatoria inicialmente.

Opcoes:

- consultas diretas com indices existentes;
- indices adicionais em campos pesquisados;
- tabela futura de read model somente se volume justificar.

Nao criar read model antes de medir volume e latencia.

### Fase DB3 - Home triage

Sem tabela obrigatoria inicialmente.

Fontes:

- agenda;
- timeline;
- contratos/vinculos;
- Focus Board notes quando existir;
- dominios futuros de ferias/experiencia.

Se houver necessidade de salvar estado de trabalho, criar tabela propria depois
de validar o fluxo.

### Fase DB4 - Anexos genericos

Opcoes seguras:

1. Evoluir `Attachment` para dono polimorfico controlado por FKs opcionais e
   regra de service.
2. Criar tabela intermediaria `attachment_owner` mantendo `Attachment` como
   arquivo protegido.

Decisao pendente: escolher depois de avaliar impacto em ocorrencias e storage.

### Fase DB5 - Dominios trabalhistas futuros

Candidatos:

- ferias;
- afastamento;
- contrato de experiencia;
- ciencia/confirmacao;
- classificacao documental.

Cada dominio exige documento proprio antes de migracao.

## Plano de seguranca

### Tenant isolation

Obrigatorio em todo service novo:

- usar `tenantWhere(actor, ...)` em leitura;
- usar `tenantCreateRelation(actor)` ou FK validada por entidade relacionada em
  escrita;
- rejeitar `publicId` de outro tenant como `404` ou `403` sem conteudo;
- ignorar tenant vindo do front.

### ACL e vazamento de metadados

Regras:

- listagens retornam apenas itens autorizados;
- contagens sao sempre de itens autorizados;
- erro sem permissao nao inclui titulo/resumo;
- busca global nao informa que encontrou item bloqueado;
- notas privadas nao aparecem em Home, Pessoas, Search, Network ou Reports.

### Auditoria

Mutacoes que devem gravar `AuditLog`:

- criar, editar, concluir, reabrir, arquivar, lixeira, restaurar e deletar nota;
- mudar participantes;
- mudar visibilidade;
- criar/cancelar lembrete;
- gerar URL assinada de anexo;
- conversoes futuras de nota.

Eventos de produto da nota devem guardar resumo e diff limitado, sem capturar
segredos ou payloads grandes.

### Step-up

Reusar `SensitiveSession` para:

- download de anexo sensivel;
- leitura de conteudo critico futuro;
- acoes administrativas que exponham dados restritos.

Nao exigir step-up para toda nota privada; privacidade da nota e ACL normal,
nao necessariamente conteudo sensivel.

## Matriz de testes obrigatorios

| Area | Teste |
| --- | --- |
| Tenant | usuario A com publicId de tenant B nao acessa |
| Nota privada | usuario B no mesmo tenant nao ve titulo, resumo ou contagem |
| Nota compartilhada | participante ve; nao participante nao ve |
| PATCH | chave omitida preserva campo |
| Lixeira | soft delete mantem auditoria |
| Busca | resultado bloqueado nao aparece nem em contagem |
| Home | triagem mostra somente itens autorizados |
| Agenda | lembrete vinculado nao apaga nota |
| Anexo | sem generalizacao, nota nao aceita anexo direto |
| Migracao | `clientMigrationId` impede duplicidade |

## Validacoes tecnicas

Antes de merge de backend:

- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run prisma:format`
- `npm.cmd run prisma:generate`
- `npm.cmd run prisma:migrate:status`
- testes unitarios/service quando adicionados;
- smoke autenticado com usuario real.

Antes de publicar online:

- `SWAGGER_ENABLED=false`;
- `DEV_AUTH_BYPASS=false`;
- `PREVIEW_AUTH_BYPASS=false` fora de preview controlado;
- `PUBLIC_SUBMISSIONS_ENABLED=false` salvo rotas publicas explicitamente
  protegidas;
- seed sample desligado;
- backup do banco antes de migracao.

## Backlog tecnico revisado

### Pronto para detalhar implementacao

- Focus Board Notes sem anexos diretos;
- busca global inicial;
- Home triage aditiva;
- testes de tenant/ACL.

### Depende de decisao de dominio

- ferias;
- afastamentos;
- contrato de experiencia;
- classificacao documental avancada;
- anexos genericos.

### Depende de volume real

- read model de busca;
- cache de triagem;
- otimizacao de Network;
- relatorios recorrentes.

## Criterios de aceite tecnico

- Nenhum contrato novo quebra consumidor atual.
- Nenhum endpoint novo aceita tenant do front.
- Todo endpoint novo filtra por tenant e ACL no backend.
- Listagens e buscas nao vazam metadados bloqueados.
- Mutacoes relevantes gravam auditoria.
- Migrations sao aditivas e reversiveis por flag quando houver dado real.
- Front consegue implementar estados loading/empty/error/sem permissao a partir
  do envelope retornado.
