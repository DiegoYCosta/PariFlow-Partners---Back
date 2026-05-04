import { AccessProfileCode, PrismaClient } from '@prisma/client';
import { createPublicId } from '../src/common/utils/public-id';
import { databaseUrl } from '../src/config/env';

const prisma = new PrismaClient();

async function main() {
  if (!databaseUrl) {
    throw new Error('Banco nao configurado.');
  }

  const email = readArg('--email');
  const firebaseUid = readArg('--firebaseUid');
  const name = readArg('--name') ?? email;

  if (!email) {
    throw new Error('Informe --email.');
  }

  const user = await prisma.userSystem.upsert({
    where: { email },
    update: {
      firebaseUid: firebaseUid || undefined,
      name,
      status: 'ACTIVE'
    },
    create: {
      publicId: createPublicId('usr'),
      email,
      firebaseUid: firebaseUid || null,
      name,
      status: 'ACTIVE'
    }
  });

  const adminProfile = await prisma.accessProfile.findUniqueOrThrow({
    where: { code: AccessProfileCode.ADMIN }
  });

  await prisma.userAccessProfile.upsert({
    where: {
      userSystemId_accessProfileId: {
        userSystemId: user.id,
        accessProfileId: adminProfile.id
      }
    },
    update: {},
    create: {
      userSystemId: user.id,
      accessProfileId: adminProfile.id
    }
  });

  console.log(`Perfil ADMIN garantido para ${email}.`);
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }

  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
