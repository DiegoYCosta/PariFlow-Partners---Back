import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { AuthTokenPayload } from '../../modules/auth/interfaces/auth-token-payload.interface';

type TenantScopedWhere =
  | Prisma.ProviderCompanyWhereInput
  | Prisma.ClientCompanyWhereInput
  | Prisma.ContractWhereInput
  | Prisma.PersonWhereInput
  | Prisma.PositionWhereInput
  | Prisma.EmploymentLinkWhereInput
  | Prisma.OccurrenceWhereInput
  | Prisma.AttachmentWhereInput
  | Prisma.EntityTagWhereInput
  | Prisma.CalendarEntryWhereInput
  | Prisma.CalendarNonBusinessDayWhereInput
  | Prisma.TimelineRecordWhereInput
  | Prisma.FocusBoardNoteWhereInput
  | Prisma.FocusBoardNoteEventWhereInput
  | Prisma.SecurityEventWhereInput
  | Prisma.AuditLogWhereInput
  | Prisma.UserSystemWhereInput;

export function actorTenantPublicId(actor: AuthTokenPayload): string | null {
  return actor.tenantRootCompany?.publicId ?? null;
}

export function isLocalDevelopmentActor(actor: AuthTokenPayload): boolean {
  return (
    env.NODE_ENV !== 'production' &&
    actor.firebaseUid === 'firebase-dev-local'
  );
}

export function assertTenantAccess(actor: AuthTokenPayload): void {
  if (actorTenantPublicId(actor) || isLocalDevelopmentActor(actor)) {
    return;
  }

  throw new ForbiddenException(
    'Usuario sem empresa raiz vinculada. Acesso multiempresa bloqueado.'
  );
}

export function tenantWhere<TWhere extends TenantScopedWhere>(
  actor: AuthTokenPayload,
  where?: TWhere
): TWhere | undefined {
  const tenantPublicId = actorTenantPublicId(actor);

  if (!tenantPublicId) {
    return where;
  }

  const scope = {
    tenantRootCompany: {
      publicId: tenantPublicId
    }
  };

  if (!where || Object.keys(where).length === 0) {
    return scope as TWhere;
  }

  return {
    AND: [scope, where]
  } as TWhere;
}

export function tenantCreateRelation(actor: AuthTokenPayload):
  | { connect: { publicId: string } }
  | undefined {
  const tenantPublicId = actorTenantPublicId(actor);

  return tenantPublicId
    ? {
        connect: {
          publicId: tenantPublicId
        }
      }
    : undefined;
}

export function tenantRootCompanyIdValue(
  actor: AuthTokenPayload,
  tenantRootCompanyId?: bigint | null
): bigint | undefined {
  if (tenantRootCompanyId) {
    return tenantRootCompanyId;
  }

  // Para writes que usam relation connect, preferir tenantCreateRelation.
  // Este fallback existe para tabelas que ainda usam FK direta em blocos de
  // create/update mais antigos.
  return undefined;
}
