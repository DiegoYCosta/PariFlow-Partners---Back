import {
  AccessProfileCode,
  AttachmentClassification,
  ContractCatalogStatus,
  EntityTagClassification,
  OccurrenceNature,
  OccurrenceVisibility,
  PrismaClient,
  SensitiveAudienceGroup
} from '@prisma/client';
import { createPublicId } from '../src/common/utils/public-id';
import { databaseUrl, env } from '../src/config/env';

const prisma = new PrismaClient();

const ACCESS_PROFILES: Array<{
  code: AccessProfileCode;
  publicId: string;
  name: string;
  description: string;
  canViewSensitive: boolean;
  canDownload: boolean;
  canSoftDelete: boolean;
}> = [
  {
    code: AccessProfileCode.ADMIN,
    publicId: 'prf_admin_base',
    name: 'Administrador',
    description: 'Acesso total ao sistema e aos modulos administrativos.',
    canViewSensitive: true,
    canDownload: true,
    canSoftDelete: true
  },
  {
    code: AccessProfileCode.EXECUTIVE,
    publicId: 'prf_exec_base',
    name: 'Alta gestao',
    description: 'Visao executiva consolidada com acesso sensivel controlado.',
    canViewSensitive: true,
    canDownload: true,
    canSoftDelete: false
  },
  {
    code: AccessProfileCode.LEGAL,
    publicId: 'prf_legal_base',
    name: 'Juridico',
    description: 'Acesso ampliado a dossies, evidencias e trilha de auditoria.',
    canViewSensitive: true,
    canDownload: true,
    canSoftDelete: false
  },
  {
    code: AccessProfileCode.HR,
    publicId: 'prf_hr_base',
    name: 'RH estrategico',
    description: 'Acesso a dados administrativos, atestados e desligamentos.',
    canViewSensitive: true,
    canDownload: false,
    canSoftDelete: false
  },
  {
    code: AccessProfileCode.OPERATIONS,
    publicId: 'prf_ops_base',
    name: 'Operacao autorizada',
    description: 'Acesso operacional restrito a vinculos, postos e observacoes internas.',
    canViewSensitive: false,
    canDownload: false,
    canSoftDelete: false
  }
];

const SERVICE_CATALOG = [
  {
    publicId: 'srv_portaria',
    name: 'Portaria',
    category: 'OPERACAO',
    description: 'Servico padrao de portaria.',
    isActive: true
  },
  {
    publicId: 'srv_limpeza',
    name: 'Limpeza',
    category: 'OPERACAO',
    description: 'Servico padrao de limpeza.',
    isActive: true
  },
  {
    publicId: 'srv_zeladoria',
    name: 'Zeladoria',
    category: 'OPERACAO',
    description: 'Servico padrao de zeladoria.',
    isActive: true
  }
];

async function main() {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL ou DB_HOST/DB_USER/DB_NAME nao configurados. Configure o banco antes de rodar o seed.'
    );
  }

  console.log('Seed: iniciando perfis de acesso.');

  for (const profile of ACCESS_PROFILES) {
    await prisma.accessProfile.upsert({
      where: { code: profile.code },
      update: {
        publicId: profile.publicId,
        name: profile.name,
        description: profile.description,
        canViewSensitive: profile.canViewSensitive,
        canDownload: profile.canDownload,
        canSoftDelete: profile.canSoftDelete
      },
      create: profile
    });
  }

  console.log('Seed: iniciando catalogo basico de servicos.');

  for (const service of SERVICE_CATALOG) {
    await prisma.serviceCatalog.upsert({
      where: { publicId: service.publicId },
      update: {
        name: service.name,
        category: service.category,
        description: service.description,
        isActive: service.isActive
      },
      create: service
    });
  }

  if (env.SEED_ADMIN_EMAIL) {
    console.log('Seed: garantindo usuario admin inicial.');

    const adminUser = await prisma.userSystem.upsert({
      where: { email: env.SEED_ADMIN_EMAIL },
      update: {
        name: env.SEED_ADMIN_NAME || 'Administrador Inicial',
        firebaseUid: env.SEED_ADMIN_FIREBASE_UID || null,
        status: 'ACTIVE',
        mfaEnabled: false
      },
      create: {
        publicId: createPublicId('usr'),
        name: env.SEED_ADMIN_NAME || 'Administrador Inicial',
        email: env.SEED_ADMIN_EMAIL,
        firebaseUid: env.SEED_ADMIN_FIREBASE_UID || null,
        status: 'ACTIVE',
        mfaEnabled: false
      }
    });

    const adminProfile = await prisma.accessProfile.findUniqueOrThrow({
      where: { code: AccessProfileCode.ADMIN }
    });

    await prisma.userAccessProfile.upsert({
      where: {
        userSystemId_accessProfileId: {
          userSystemId: adminUser.id,
          accessProfileId: adminProfile.id
        }
      },
      update: {},
      create: {
        userSystemId: adminUser.id,
        accessProfileId: adminProfile.id
      }
    });
  }

  if (env.SEED_ENABLE_SAMPLE_DATA) {
    console.log('Seed: criando dados de exemplo basicos.');

    const providerCompany = await prisma.providerCompany.upsert({
      where: { document: '12345678000199' },
      update: {
        legalName: 'PariFlow Servicos Ltda',
        tradeName: 'PariFlow',
        status: 'ACTIVE',
        contactsJson: {
          phone: '(11) 4000-0000',
          email: 'contato@pariflow.local'
        },
        notes: 'Registro de exemplo para ambiente inicial.'
      },
      create: {
        publicId: 'epr_seed_base',
        legalName: 'PariFlow Servicos Ltda',
        tradeName: 'PariFlow',
        document: '12345678000199',
        status: 'ACTIVE',
        contactsJson: {
          phone: '(11) 4000-0000',
          email: 'contato@pariflow.local'
        },
        notes: 'Registro de exemplo para ambiente inicial.'
      }
    });

    const clientCompany = await prisma.clientCompany.upsert({
      where: { publicId: 'cli_seed_base' },
      update: {
        name: 'Condominio Bela Vista',
        document: '99887766000155',
        clientType: 'CONDOMINIO',
        addressJson: {
          city: 'Sao Paulo',
          state: 'SP'
        },
        contactName: 'Maria Oliveira',
        status: 'ACTIVE'
      },
      create: {
        publicId: 'cli_seed_base',
        name: 'Condominio Bela Vista',
        document: '99887766000155',
        clientType: 'CONDOMINIO',
        addressJson: {
          city: 'Sao Paulo',
          state: 'SP'
        },
        contactName: 'Maria Oliveira',
        status: 'ACTIVE'
      }
    });

    const contractType = await prisma.contractType.upsert({
      where: { publicId: 'tco_seed_contratacao' },
      update: {
        name: 'Contratacao',
        description:
          'Tipo base para contratos de prestacao ou contratacao operacional.',
        status: ContractCatalogStatus.ACTIVE
      },
      create: {
        publicId: 'tco_seed_contratacao',
        name: 'Contratacao',
        description:
          'Tipo base para contratos de prestacao ou contratacao operacional.',
        status: ContractCatalogStatus.ACTIVE
      }
    });

    await prisma.contractType.upsert({
      where: { publicId: 'tco_seed_locacao' },
      update: {
        name: 'Locacao',
        description: 'Tipo base para contratos de locacao.',
        status: ContractCatalogStatus.ACTIVE
      },
      create: {
        publicId: 'tco_seed_locacao',
        name: 'Locacao',
        description: 'Tipo base para contratos de locacao.',
        status: ContractCatalogStatus.ACTIVE
      }
    });

    await prisma.contractType.upsert({
      where: { publicId: 'tco_seed_demissao' },
      update: {
        name: 'Demissao',
        description:
          'Tipo base para documentos e contratos ligados a desligamento.',
        status: ContractCatalogStatus.ACTIVE
      },
      create: {
        publicId: 'tco_seed_demissao',
        name: 'Demissao',
        description:
          'Tipo base para documentos e contratos ligados a desligamento.',
        status: ContractCatalogStatus.ACTIVE
      }
    });

    await prisma.contractModel.upsert({
      where: {
        contractTypeId_name: {
          contractTypeId: contractType.id,
          name: 'Limpeza 12x36'
        }
      },
      update: {
        publicId: 'mco_seed_limpeza_12x36',
        description:
          'Modelo reutilizavel de contrato para escala de limpeza 12x36.',
        defaultSchedule: '12x36',
        status: ContractCatalogStatus.ACTIVE
      },
      create: {
        publicId: 'mco_seed_limpeza_12x36',
        contractTypeId: contractType.id,
        name: 'Limpeza 12x36',
        description:
          'Modelo reutilizavel de contrato para escala de limpeza 12x36.',
        defaultSchedule: '12x36',
        status: ContractCatalogStatus.ACTIVE
      }
    });

    await prisma.contractModel.upsert({
      where: {
        contractTypeId_name: {
          contractTypeId: contractType.id,
          name: 'Limpeza 22hrs semanais'
        }
      },
      update: {
        publicId: 'mco_seed_limpeza_22h',
        description:
          'Modelo reutilizavel de contrato para limpeza parcial semanal.',
        defaultSchedule: '22hrs semanais',
        status: ContractCatalogStatus.ACTIVE
      },
      create: {
        publicId: 'mco_seed_limpeza_22h',
        contractTypeId: contractType.id,
        name: 'Limpeza 22hrs semanais',
        description:
          'Modelo reutilizavel de contrato para limpeza parcial semanal.',
        defaultSchedule: '22hrs semanais',
        status: ContractCatalogStatus.ACTIVE
      }
    });

    const contractModel = await prisma.contractModel.upsert({
      where: {
        contractTypeId_name: {
          contractTypeId: contractType.id,
          name: 'Portaria 12x36'
        }
      },
      update: {
        publicId: 'mco_seed_portaria_12x36',
        description:
          'Modelo reutilizavel de contrato para cobertura de portaria 12x36.',
        defaultSchedule: '12x36',
        status: ContractCatalogStatus.ACTIVE
      },
      create: {
        publicId: 'mco_seed_portaria_12x36',
        contractTypeId: contractType.id,
        name: 'Portaria 12x36',
        description:
          'Modelo reutilizavel de contrato para cobertura de portaria 12x36.',
        defaultSchedule: '12x36',
        status: ContractCatalogStatus.ACTIVE
      }
    });

    const contract = await prisma.contract.upsert({
      where: { publicId: 'ctr_seed_base' },
      update: {
        providerCompanyId: providerCompany.id,
        clientCompanyId: clientCompany.id,
        contractTypeId: contractType.id,
        contractModelId: contractModel.id,
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: null,
        status: 'ACTIVE',
        notes: 'Contrato de exemplo para desenvolvimento.'
      },
      create: {
        publicId: 'ctr_seed_base',
        providerCompanyId: providerCompany.id,
        clientCompanyId: clientCompany.id,
        contractTypeId: contractType.id,
        contractModelId: contractModel.id,
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: null,
        status: 'ACTIVE',
        notes: 'Contrato de exemplo para desenvolvimento.'
      }
    });

    await prisma.contractDocument.upsert({
      where: { publicId: 'cdo_seed_contrato_assinado' },
      update: {
        contractId: contract.id,
        title: 'Contrato assinado',
        classification: AttachmentClassification.FORMAL_DOCUMENT,
        fileName: 'contrato-assinado-seed.pdf',
        mimeType: 'application/pdf',
        externalLink: 'https://example.com/contrato-assinado-seed.pdf',
        physicalLocation: null,
        notes:
          'Documento seedado para validar anexos e links na tela de contratos.'
      },
      create: {
        publicId: 'cdo_seed_contrato_assinado',
        contractId: contract.id,
        title: 'Contrato assinado',
        classification: AttachmentClassification.FORMAL_DOCUMENT,
        fileName: 'contrato-assinado-seed.pdf',
        mimeType: 'application/pdf',
        externalLink: 'https://example.com/contrato-assinado-seed.pdf',
        physicalLocation: null,
        notes:
          'Documento seedado para validar anexos e links na tela de contratos.'
      }
    });

    const baseService = await prisma.serviceCatalog.findUniqueOrThrow({
      where: { publicId: 'srv_portaria' }
    });

    const position = await prisma.position.upsert({
      where: { publicId: 'pos_seed_base' },
      update: {
        contractId: contract.id,
        serviceId: baseService.id,
        name: 'Porteiro Diurno',
        location: 'Portaria principal',
        shift: 'DIURNO',
        schedule: '12x36',
        requirements: 'Controle de acesso e atendimento ao condominio.',
        status: 'ACTIVE'
      },
      create: {
        publicId: 'pos_seed_base',
        contractId: contract.id,
        serviceId: baseService.id,
        name: 'Porteiro Diurno',
        location: 'Portaria principal',
        shift: 'DIURNO',
        schedule: '12x36',
        requirements: 'Controle de acesso e atendimento ao condominio.',
        status: 'ACTIVE'
      }
    });

    const person = await prisma.person.upsert({
      where: { publicId: 'pes_seed_base' },
      update: {
        name: 'Carlos Eduardo Lima',
        cpf: '12345678900',
        rg: '44556677',
        email: 'carlos.lima@pariflow.local',
        phone: '(11) 98888-0000',
        birthDate: new Date('1991-04-10T00:00:00.000Z'),
        addressJson: {
          city: 'Sao Paulo',
          state: 'SP'
        },
        notes: 'Pessoa de exemplo para fluxo inicial de vinculos.'
      },
      create: {
        publicId: 'pes_seed_base',
        name: 'Carlos Eduardo Lima',
        cpf: '12345678900',
        rg: '44556677',
        email: 'carlos.lima@pariflow.local',
        phone: '(11) 98888-0000',
        birthDate: new Date('1991-04-10T00:00:00.000Z'),
        addressJson: {
          city: 'Sao Paulo',
          state: 'SP'
        },
        notes: 'Pessoa de exemplo para fluxo inicial de vinculos.'
      }
    });

    await prisma.externalWork.upsert({
      where: { publicId: 'tex_seed_base' },
      update: {
        personId: person.id,
        companyName: 'Mercado Alpha',
        roleName: 'Repositor',
        schedule: '6x1',
        startsAt: new Date('2025-01-15T00:00:00.000Z'),
        endsAt: null,
        status: 'ACTIVE',
        notes: 'Trabalho externo informado no cadastro inicial.'
      },
      create: {
        publicId: 'tex_seed_base',
        personId: person.id,
        companyName: 'Mercado Alpha',
        roleName: 'Repositor',
        schedule: '6x1',
        startsAt: new Date('2025-01-15T00:00:00.000Z'),
        endsAt: null,
        status: 'ACTIVE',
        notes: 'Trabalho externo informado no cadastro inicial.'
      }
    });

    const employmentLink = await prisma.employmentLink.upsert({
      where: { publicId: 'vin_seed_base' },
      update: {
        personId: person.id,
        providerCompanyId: providerCompany.id,
        contractId: contract.id,
        positionId: position.id,
        type: 'CLT',
        status: 'ACTIVE',
        startsAt: new Date('2026-02-01T00:00:00.000Z'),
        endsAt: null
      },
      create: {
        publicId: 'vin_seed_base',
        personId: person.id,
        providerCompanyId: providerCompany.id,
        contractId: contract.id,
        positionId: position.id,
        type: 'CLT',
        status: 'ACTIVE',
        startsAt: new Date('2026-02-01T00:00:00.000Z'),
        endsAt: null
      }
    });

    // Esse vinculo base serve de ancora para ocorrencias, anexos e trilhas de
    // historico quando esses modulos entrarem na proxima rodada.
    await prisma.employmentMove.upsert({
      where: { publicId: 'mov_seed_base' },
      update: {
        employmentLinkId: employmentLink.id,
        moveType: 'ALOCACAO_INICIAL',
        origin: 'Admissao',
        destination: position.name,
        movedAt: new Date('2026-02-01T08:00:00.000Z'),
        notes: 'Movimentacao inicial do vinculo de exemplo.'
      },
      create: {
        publicId: 'mov_seed_base',
        employmentLinkId: employmentLink.id,
        moveType: 'ALOCACAO_INICIAL',
        origin: 'Admissao',
        destination: position.name,
        movedAt: new Date('2026-02-01T08:00:00.000Z'),
        notes: 'Movimentacao inicial do vinculo de exemplo.'
      }
    });

    const sensitiveOwner = await ensureSeedSensitiveOwner();

    const occurrence = await prisma.occurrence.upsert({
      where: { publicId: 'ocr_seed_people_sensitive' },
      update: {
        personId: person.id,
        providerCompanyId: providerCompany.id,
        employmentLinkId: employmentLink.id,
        positionId: position.id,
        type: 'OBSERVACAO_OPERACIONAL',
        scope: 'PEOPLE_PROFILE',
        nature: OccurrenceNature.NEUTRAL,
        title: 'Observacao operacional para validacao da ficha',
        description:
          'Ocorrencia seedada para validar tags sensiveis e anexos protegidos no corte vertical de People.',
        occurredAt: new Date('2026-04-15T10:00:00.000Z'),
        severityLevel: 'LOW',
        visibility: OccurrenceVisibility.SENSITIVE,
        showInExecutivePanel: true,
        status: 'ACTIVE'
      },
      create: {
        publicId: 'ocr_seed_people_sensitive',
        personId: person.id,
        providerCompanyId: providerCompany.id,
        employmentLinkId: employmentLink.id,
        positionId: position.id,
        type: 'OBSERVACAO_OPERACIONAL',
        scope: 'PEOPLE_PROFILE',
        nature: OccurrenceNature.NEUTRAL,
        title: 'Observacao operacional para validacao da ficha',
        description:
          'Ocorrencia seedada para validar tags sensiveis e anexos protegidos no corte vertical de People.',
        occurredAt: new Date('2026-04-15T10:00:00.000Z'),
        severityLevel: 'LOW',
        visibility: OccurrenceVisibility.SENSITIVE,
        showInExecutivePanel: true,
        status: 'ACTIVE'
      }
    });

    await prisma.entityTag.upsert({
      where: { publicId: 'tag_seed_people_sensitive' },
      update: {
        targetType: 'PERSON',
        personId: person.id,
        providerCompanyId: null,
        classification: EntityTagClassification.ROUTINE_CONTEXT,
        status: 'ACTIVE',
        label: 'prefere troca avisada',
        content:
          'Validacao real de tag sensivel: comunicar mudanca de escala com antecedencia quando possivel.',
        color: '#0F766E',
        sortOrder: 1,
        isAnonymousSubmission: false,
        ownerUserSystemId: sensitiveOwner.id,
        createdByUserSystemId: sensitiveOwner.id,
        removedByUserSystemId: null,
        removedAt: null,
        audienceGroups: {
          deleteMany: {},
          create: [
            { groupKey: SensitiveAudienceGroup.DIRECTOR },
            { groupKey: SensitiveAudienceGroup.SUPERVISION }
          ]
        },
        audienceUsers: {
          deleteMany: {}
        }
      },
      create: {
        publicId: 'tag_seed_people_sensitive',
        targetType: 'PERSON',
        personId: person.id,
        classification: EntityTagClassification.ROUTINE_CONTEXT,
        status: 'ACTIVE',
        label: 'prefere troca avisada',
        content:
          'Validacao real de tag sensivel: comunicar mudanca de escala com antecedencia quando possivel.',
        color: '#0F766E',
        sortOrder: 1,
        isAnonymousSubmission: false,
        ownerUserSystemId: sensitiveOwner.id,
        createdByUserSystemId: sensitiveOwner.id,
        audienceGroups: {
          create: [
            { groupKey: SensitiveAudienceGroup.DIRECTOR },
            { groupKey: SensitiveAudienceGroup.SUPERVISION }
          ]
        }
      }
    });

    await prisma.attachment.upsert({
      where: { publicId: 'anx_seed_people_sensitive' },
      update: {
        occurrenceId: occurrence.id,
        ownerUserSystemId: sensitiveOwner.id,
        createdByUserSystemId: sensitiveOwner.id,
        displayScope: 'people_profile',
        classification: AttachmentClassification.SENSITIVE_ATTACHMENT,
        fileName: 'relato-operacional-seed.pdf',
        mimeType: 'application/pdf',
        storagePath: 'seed/people/relato-operacional-seed.pdf',
        externalLink: null,
        physicalLocation: null,
        visibleInExecutive: true,
        visibleInContext: true,
        requiresConfirmation: true,
        version: 1,
        status: 'ACTIVE',
        deletedAt: null,
        deleteReason: null,
        audienceGroups: {
          deleteMany: {},
          create: [
            { groupKey: SensitiveAudienceGroup.DIRECTOR },
            { groupKey: SensitiveAudienceGroup.SUPERVISION }
          ]
        },
        audienceUsers: {
          deleteMany: {}
        }
      },
      create: {
        publicId: 'anx_seed_people_sensitive',
        occurrenceId: occurrence.id,
        ownerUserSystemId: sensitiveOwner.id,
        createdByUserSystemId: sensitiveOwner.id,
        displayScope: 'people_profile',
        classification: AttachmentClassification.SENSITIVE_ATTACHMENT,
        fileName: 'relato-operacional-seed.pdf',
        mimeType: 'application/pdf',
        storagePath: 'seed/people/relato-operacional-seed.pdf',
        visibleInExecutive: true,
        visibleInContext: true,
        requiresConfirmation: true,
        version: 1,
        status: 'ACTIVE',
        audienceGroups: {
          create: [
            { groupKey: SensitiveAudienceGroup.DIRECTOR },
            { groupKey: SensitiveAudienceGroup.SUPERVISION }
          ]
        }
      }
    });
  }

  console.log('Seed finalizado com sucesso.');
}

async function ensureSeedSensitiveOwner() {
  return prisma.userSystem.upsert({
    where: { email: 'seed.admin@pariflow.local' },
    update: {
      publicId: 'usr_seed_admin',
      name: 'Seed Admin',
      status: 'ACTIVE',
      mfaEnabled: false
    },
    create: {
      publicId: 'usr_seed_admin',
      name: 'Seed Admin',
      email: 'seed.admin@pariflow.local',
      status: 'ACTIVE',
      mfaEnabled: false
    }
  });
}

main()
  .catch((error) => {
    console.error('Seed falhou.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
