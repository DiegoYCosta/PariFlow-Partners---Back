# Busca Global - Contrato Backend

Data de referencia: `2026-07-12`.

Status: implementado em `2026-07-13`. O header do front consome este contrato
para consulta agrupada e navegacao direta.

## Endpoint

`GET /api/v1/search`

## Query

- `q`: obrigatorio, 2 a 80 caracteres.
- `types`: CSV opcional. Valores: `people`, `provider_companies`,
  `client_companies`, `contracts`, `positions`.
- `limit`: 1 a 10 por grupo, default 5.
- `includeInactive`: boolean, default `false`.

Nao aceitar tenant em query.

## Resposta

O backend usa envelope global de sucesso `{ data, meta.traceId }`. A estrutura
abaixo representa o payload dentro de `data`; `query` e `authorizedTotal` ficam
em `data.meta` para preservar o contrato global ja consumido pelo front.

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
            "context": "Cliente X / Contrato Y",
            "routeTarget": {
              "workspace": "people",
              "publicId": "pes_..."
            },
            "badges": ["Ativo"]
          }
        ]
      }
    ],
    "meta": {
      "query": "joao",
      "authorizedTotal": 1
    }
  },
  "meta": {
    "traceId": "req-..."
  }
}
```

## Regras de seguranca

- Retornar somente entidades autorizadas.
- `authorizedTotal` nao conta bloqueados.
- Nao retornar grupos vazios por falta de permissao sensivel se isso revelar
  existencia de dado.
- Mascarar documentos, CPF, email e telefone conforme capability.
- Nao buscar conteudo de notas privadas na primeira fase.

## Ranking inicial

1. match exato por publicId permitido;
2. match por nome/razao social no inicio;
3. match por documento permitido;
4. match por nome contendo termo;
5. ativos antes de inativos;
6. atualizados recentemente como desempate.

## Fontes iniciais

- pessoas;
- empresas prestadoras;
- clientes;
- contratos;
- postos.

Fora da fase inicial:

- notas;
- anexos;
- conteudo de ocorrencias sensiveis;
- historico recente de busca.

## Criterio de aceite

- usuario localiza pessoa conhecida em ate 10 segundos no front;
- publicId de outro tenant nao retorna resultado;
- busca por documento sensivel respeita mascaramento;
- endpoint retorna vazio sem revelar bloqueados.
