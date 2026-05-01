import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildPaginationArgs, buildPaginationMeta } from '../../common/utils/pagination';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { createPublicId } from '../../common/utils/public-id';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreatePersonDto } from './dto/create-person.dto';

type PersonWithCounts = Prisma.PersonGetPayload<{
  include: {
    _count: {
      select: {
        externalWorks: true;
        links: true;
      };
    };
  };
}>;

type PersonWithRelations = Prisma.PersonGetPayload<{
  include: {
    externalWorks: true;
    links: {
      include: {
        providerCompany: true;
        contract: {
          include: {
            clientCompany: true;
          };
        };
        position: true;
        dismissal: true;
      };
    };
  };
}>;

@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto) {
    this.prisma.assertConfigured();

    const { page, perPage, skip } = buildPaginationArgs(query);
    const search = query.search?.trim();

    const where: Prisma.PersonWhereInput | undefined = search
      ? {
          OR: [
            { name: { contains: search } },
            { cpf: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } }
          ]
        }
      : undefined;

    try {
      const [total, items] = await Promise.all([
        this.prisma.person.count({ where }),
        this.prisma.person.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: {
                externalWorks: true,
                links: true
              }
            }
          }
        })
      ]);

      return {
        items: items.map((item) => this.mapPersonListItem(item)),
        pagination: buildPaginationMeta(page, perPage, total)
      };
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async findOne(publicId: string) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.person.findUnique({
        where: { publicId },
        include: {
          externalWorks: {
            orderBy: [{ startsAt: 'desc' }, { companyName: 'asc' }]
          },
          links: {
            orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
            include: {
              providerCompany: true,
              contract: {
                include: {
                  clientCompany: true
                }
              },
              position: true,
              dismissal: true
            }
          }
        }
      });

      if (!item) {
        throw new NotFoundException('Pessoa nao encontrada.');
      }

      return this.mapPersonDetail(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Pessoa nao encontrada.'
      });
    }
  }

  async create(dto: CreatePersonDto) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.person.create({
        data: {
          publicId: createPublicId('pes'),
          name: dto.name,
          cpf: dto.cpf ?? null,
          rg: dto.rg ?? null,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          addressJson: dto.addressJson as Prisma.InputJsonValue | undefined,
          notes: dto.notes ?? null,
          externalWorks: dto.externalWorks?.length
            ? {
                create: dto.externalWorks.map((work) => ({
                  publicId: createPublicId('tex'),
                  companyName: work.companyName,
                  roleName: work.roleName ?? null,
                  schedule: work.schedule ?? null,
                  startsAt: work.startsAt ? new Date(work.startsAt) : null,
                  endsAt: work.endsAt ? new Date(work.endsAt) : null,
                  status: work.status ?? null,
                  notes: work.notes ?? null
                }))
              }
            : undefined
        },
        include: {
          externalWorks: {
            orderBy: [{ startsAt: 'desc' }, { companyName: 'asc' }]
          },
          links: {
            orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
            include: {
              providerCompany: true,
              contract: {
                include: {
                  clientCompany: true
                }
              },
              position: true,
              dismissal: true
            }
          }
        }
      });

      return this.mapPersonDetail(item);
    } catch (error) {
      rethrowPrismaError(error, {
        duplicate: 'Ja existe pessoa cadastrada com este CPF.'
      });
    }
  }

  private mapPersonListItem(item: PersonWithCounts) {
    return {
      publicId: item.publicId,
      name: item.name,
      cpf: item.cpf,
      rg: item.rg,
      email: item.email,
      phone: item.phone,
      birthDate: item.birthDate,
      linkCount: item._count.links,
      externalWorkCount: item._count.externalWorks
    };
  }

  private mapPersonDetail(item: PersonWithRelations) {
    // Tags sensiveis seguem em endpoint dedicado para evitar vazamento de
    // metadado quando a ACL por autoria, grupo e pessoa ainda nao foi calculada.
    return {
      publicId: item.publicId,
      name: item.name,
      cpf: item.cpf,
      rg: item.rg,
      email: item.email,
      phone: item.phone,
      birthDate: item.birthDate,
      addressJson: item.addressJson,
      notes: item.notes,
      externalWorks: item.externalWorks.map((work) => ({
        publicId: work.publicId,
        companyName: work.companyName,
        roleName: work.roleName,
        schedule: work.schedule,
        startsAt: work.startsAt,
        endsAt: work.endsAt,
        status: work.status,
        notes: work.notes
      })),
      links: item.links.map((link) => ({
        publicId: link.publicId,
        type: link.type,
        status: link.status,
        startsAt: link.startsAt,
        endsAt: link.endsAt,
        providerCompany: {
          publicId: link.providerCompany.publicId,
          legalName: link.providerCompany.legalName,
          tradeName: link.providerCompany.tradeName
        },
        contract: {
          publicId: link.contract.publicId,
          status: link.contract.status,
          clientCompany: {
            publicId: link.contract.clientCompany.publicId,
            name: link.contract.clientCompany.name
          }
        },
        position: {
          publicId: link.position.publicId,
          name: link.position.name,
          status: link.position.status
        },
        dismissal: link.dismissal
          ? {
              publicId: link.dismissal.publicId,
              dismissedAt: link.dismissal.dismissedAt,
              reason: link.dismissal.reason,
              dismissalType: link.dismissal.dismissalType
            }
          : null
      }))
    };
  }
}