import { PrismaClient, AccessProfileCode } from '@prisma/client';
import { createPublicId } from '../src/common/utils/public-id';
import { env } from '../src/config/env';

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
  if (!env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL nao configurada. Configure o banco antes de rodar o seed.'
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

    await prisma.contract.upsert({
      where: { publicId: 'ctr_seed_base' },
      update: {
        providerCompanyId: providerCompany.id,
        clientCompanyId: clientCompany.id,
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: null,
        status: 'ACTIVE',
        notes: 'Contrato de exemplo para desenvolvimento.'
      },
      create: {
        publicId: 'ctr_seed_base',
        providerCompanyId: providerCompany.id,
        clientCompanyId: clientCompany.id,
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: null,
        status: 'ACTIVE',
        notes: 'Contrato de exemplo para desenvolvimento.'
      }
    });
  }

  console.log('Seed finalizado com sucesso.');
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
