# Home Triage - Contrato Backend Planejado

Data de referencia: `2026-07-12`.

Status: evolucao planejada de `GET /api/v1/dashboard/home`.

## Objetivo

Transformar a Home em central de triagem diaria com prioridades, prazos,
retomada e agenda imediata, mantendo o contrato atual de dashboard compativel.

## Estrutura aditiva

Adicionar `data.triage` sem remover campos atuais.

```json
{
  "data": {
    "triage": {
      "today": "2026-07-12",
      "rootCompany": {
        "publicId": "emp_...",
        "label": "PariFlow Partners"
      },
      "priorities": [],
      "upcomingDeadlines": [],
      "resumeItems": [],
      "immediateAgenda": []
    }
  }
}
```

## Item padrao

```json
{
  "publicId": "tri_...",
  "source": "calendar_entry",
  "sourcePublicId": "agi_...",
  "title": "Retorno de ferias",
  "subjectType": "person",
  "subjectPublicId": "pes_...",
  "subjectLabel": "Ana Paula Oliveira",
  "dueAt": "2026-07-12T09:00:00-03:00",
  "severity": "attention",
  "responsibleLabel": "Diego",
  "action": {
    "label": "Abrir origem",
    "workspace": "timeline",
    "publicId": "agi_..."
  }
}
```

## Fontes por fase

Fase 1:

- agenda de hoje e proximos dias;
- timeline manual relevante;
- vinculos pendentes ja existentes;
- contratos com vigencia proxima se dado ja existir.

Fase 2:

- Focus Board notes autorizadas;
- documentos pendentes quando contrato existir.

Fase futura:

- ferias/afastamentos;
- contrato de experiencia calculado;
- decisoes formais pendentes.

## Regras

- maximo 5 itens por grupo.
- item sem permissao nao entra.
- severidade vem do backend.
- front nao calcula prazo legal.
- fontes futuras nao entram como texto inferido.

## Criterio de aceite

- Home carrega sem quebrar consumidores atuais.
- API vazia produz empty state no front.
- Prioridade sem permissao nao aparece.
- Clique abre origem canonica por `workspace` e `publicId`.
