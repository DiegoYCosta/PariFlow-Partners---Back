import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { SearchService } from './search.service';

function actor(
  overrides: Partial<AuthTokenPayload> = {}
): AuthTokenPayload {
  return {
    sub: 'usr_owner',
    firebaseUid: 'firebase-owner',
    email: 'owner@pariflow.test',
    tenantRootCompany: {
      publicId: 'ten_a',
      tradeName: 'Tenant A',
      legalName: 'Tenant A LTDA',
      cnpj: '00000000000100',
      status: 'ACTIVE'
    },
    profiles: ['ADMINISTRADOR'],
    audienceGroups: [],
    securityContext: 'privileged',
    capabilities: {
      canViewSensitive: false,
      canDownloadAttachments: false,
      canSoftDeleteAttachment: false
    },
    ...overrides
  };
}

function personRow() {
  return {
    publicId: 'pes_joao',
    name: 'Joao Silva',
    cpf: '00011122234',
    email: 'joao@pariflow.test',
    phone: '11999990000',
    links: [
      {
        position: { name: 'Analista DP' },
        contract: { clientCompany: { name: 'Cliente A' } },
        providerCompany: {
          tradeName: 'Prestadora A',
          legalName: 'Prestadora A LTDA'
        }
      }
    ]
  };
}

class SearchPrismaMock {
  countArgs: unknown[] = [];
  findManyArgs: unknown[] = [];

  assertConfigured() {}

  person = {
    count: async (args: unknown) => {
      this.countArgs.push(args);
      return 1;
    },
    findMany: async (args: unknown) => {
      this.findManyArgs.push(args);
      return [personRow()];
    }
  };

  providerCompany = {
    count: async () => 0,
    findMany: async () => []
  };

  clientCompany = {
    count: async () => 0,
    findMany: async () => []
  };

  contract = {
    count: async () => 0,
    findMany: async () => []
  };

  position = {
    count: async () => 0,
    findMany: async () => []
  };
}

describe('SearchService', () => {
  it('aplica tenant e nao busca/retorna documentos sem capability sensivel', async () => {
    const prisma = new SearchPrismaMock();
    const service = new SearchService(prisma as never);

    const result = await service.search(
      { q: 'jo', types: ['people'], limit: 5, includeInactive: false },
      actor()
    );
    const countArgs = prisma.countArgs[0] as { where: unknown };
    const whereJson = JSON.stringify(countArgs.where);

    assert.match(whereJson, /"tenantRootCompany"/);
    assert.match(whereJson, /"publicId":"ten_a"/);
    assert.doesNotMatch(whereJson, /"cpf"/);
    assert.doesNotMatch(whereJson, /"email"/);
    assert.doesNotMatch(whereJson, /"phone"/);
    assert.equal(result.meta.authorizedTotal, 1);
    assert.equal(result.groups[0].type, 'people');
    assert.deepEqual(result.groups[0].items[0].badges, ['Ativo']);
  });

  it('permite busca sensivel e retorna documento mascarado quando autorizado', async () => {
    const prisma = new SearchPrismaMock();
    const service = new SearchService(prisma as never);

    const result = await service.search(
      { q: '1234', types: ['people'], limit: 5, includeInactive: false },
      actor({
        capabilities: {
          canViewSensitive: true,
          canDownloadAttachments: false,
          canSoftDeleteAttachment: false
        }
      })
    );
    const countArgs = prisma.countArgs[0] as { where: unknown };
    const whereJson = JSON.stringify(countArgs.where);

    assert.match(whereJson, /"cpf"/);
    assert.match(whereJson, /"email"/);
    assert.match(whereJson, /"phone"/);
    assert.deepEqual(result.groups[0].items[0].badges, [
      'Ativo',
      'CPF final 2234'
    ]);
  });
});
