# Documentacao do Backend

Data de referencia: `2026-07-09`.

Esta pasta concentra a documentacao operacional do backend que precisa viajar
junto com o repositorio. As pastas externas em `D:\DEV\flutter\JOTABE` continuam
como fonte historica e de produto, mas os links do README agora resolvem dentro
do projeto.

## Ordem de leitura

1. [README do backend](../README.md)
2. [AWS Security Checklist](aws-security-checklist.md)
3. [Client onboarding e isolamento por empresa raiz](client-onboarding-and-tenant-isolation.md)
4. [Calendario compartilhado, banco e notificacoes](calendario-compartilhado-backend.md)
5. [Plano Tecnico UX v1 - Backend, Banco e Seguranca](ux-data-security-contracts-plan-v1.md)
6. [Focus Board Hub e Agenda](focus-board-hub-agenda.md)
7. [Focus Board Notes e Tasks - Contrato Backend Planejado](focus-board-notes-contract.md)
8. [Focus Board - Especificacao de Implementacao Fase 1](focus-board-phase-1-implementation-spec.md)
9. [Focus Board - Draft de Schema Prisma](focus-board-prisma-schema-draft.md)
10. [Focus Board - Contrato de API e DTOs](focus-board-api-dto-contract.md)
11. [Focus Board - Plano de Testes Backend](focus-board-test-plan.md)
12. [Focus Board - Migracao de Notas Locais](focus-board-local-migration-plan.md)
13. [Focus Board - Rollout e Feature Flag](focus-board-rollout-plan.md)
14. [Busca Global - Contrato Backend Planejado](global-search-contract-spec.md)
15. [Home Triage - Contrato Backend Planejado](home-triage-contract-spec.md)
16. [Anexos - Plano de Generalizacao de Dono](attachment-owner-generalization-plan.md)
17. [API de entidades operacionais](operational-entities-api.md)
18. [Network Timeline Read Model](network-timeline-read-model-plan.md)
19. [Fixture do payload de Network Timeline](network-timeline-payload-example.json)

## Estado atual resumido

| Area | Estado |
| --- | --- |
| Auth | Firebase Admin, JWT interno, refresh rotativo, logout e `PATCH /auth/me` ativos |
| Tenant | services centrais aplicam escopo por empresa raiz para usuarios reais |
| Operacao | empresas, clientes, contratos, catalogo, pessoas, vinculos, ocorrencias, tags e anexos ativos |
| Dashboard | `GET /api/v1/dashboard/home` ativo para home sem mock |
| Timeline | `GET/POST/PATCH/DELETE /api/v1/timeline` ativo |
| Agenda | compromissos, lembretes, `NOTICE`, recorrencia simples, dias nao uteis e aplicabilidade ativos |
| Relatorios | `POST /api/v1/relatorios/executar` ativo, com CSV estruturado para relatorios prontos |
| Network | `GET /api/v1/network/graph` e `GET /api/v1/network/timeline` ativos |
| Notificacoes | `notification_outbox`, SMTP e WhatsApp configuravel |
| AWS | homologacao por IP atras de Apache/PM2/MySQL local |

## Fontes de verdade

- Codigo backend: `src/`
- Banco: `prisma/schema.prisma` e `prisma/migrations/`
- Ambiente: `.env.example`
- Deploy: `D:\DEV\flutter\JOTABE\deploy_pfp_aws.ps1` e `.sh`
- Front consumidor: `D:\DEV\flutter\JOTABE\PariFlow Partners - Front`

## Nao reabrir como pendencia generica

- criar CRUD basico de empresas/clientes/contratos;
- criar People, ocorrencias, tags, anexos ou vinculos;
- criar Network;
- criar dashboard inicial;
- criar agenda ou relatorios basicos;
- reintroduzir mock/sample como fallback de runtime.
