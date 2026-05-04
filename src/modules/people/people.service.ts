import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildPaginationArgs, buildPaginationMeta } from '../../common/utils/pagination';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { createPublicId } from '../../common/utils/public-id';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

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

const personDetailInclude = {
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
} satisfies Prisma.PersonInclude;

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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
        include: personDetailInclude
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
        data: this.buildPersonCreateData(dto),
        include: personDetailInclude
      });

      return this.mapPersonDetail(item);
    } catch (error) {
      rethrowPrismaError(error, {
        duplicate: 'Ja existe pessoa cadastrada com este CPF.'
      });
    }
  }

  async update(publicId: string, dto: UpdatePersonDto) {
    this.prisma.assertConfigured();

    await this.ensurePersonExists(publicId);

    try {
      const item = await this.prisma.person.update({
        where: { publicId },
        data: {
          ...this.buildPersonUpdateData(dto),
          externalWorks:
            dto.externalWorks === undefined
              ? undefined
              : {
                  deleteMany: {},
                  create: dto.externalWorks.map((work) => ({
                    publicId: createPublicId('tex'),
                    companyName: work.companyName,
                    roleName: this.nullableText(work.roleName),
                    schedule: this.nullableText(work.schedule),
                    startsAt: work.startsAt ? new Date(work.startsAt) : null,
                    endsAt: work.endsAt ? new Date(work.endsAt) : null,
                    status: this.nullableText(work.status),
                    notes: this.nullableText(work.notes)
                  }))
                }
        },
        include: personDetailInclude
      });

      return this.mapPersonDetail(item);
    } catch (error) {
      rethrowPrismaError(error, {
        duplicate: 'Ja existe pessoa cadastrada com este CPF.',
        notFound: 'Pessoa nao encontrada.'
      });
    }
  }

  async remove(publicId: string) {
    this.prisma.assertConfigured();

    const person = await this.prisma.person.findUnique({
      where: { publicId },
      include: {
        _count: {
          select: {
            links: true,
            occurrences: true,
            entityTags: true,
            externalWorks: true
          }
        }
      }
    });

    if (!person) {
      throw new NotFoundException('Pessoa nao encontrada.');
    }

    if (
      person._count.links > 0 ||
      person._count.occurrences > 0 ||
      person._count.entityTags > 0
    ) {
      throw new BadRequestException(
        'Pessoa ja possui vinculos, ocorrencias ou tags e nao pode ser removida fisicamente.'
      );
    }

    try {
      await this.prisma.person.delete({
        where: { publicId }
      });

      return {
        publicId,
        deleted: true,
        removedExternalWorkCount: person._count.externalWorks
      };
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Pessoa nao encontrada.'
      });
    }
  }

  private buildPersonCreateData(dto: CreatePersonDto): Prisma.PersonCreateInput {
    return {
      publicId: createPublicId('pes'),
      name: dto.name,
      cpf: this.nullableText(dto.cpf),
      rg: this.nullableText(dto.rg),
      email: this.nullableText(dto.email),
      phone: this.nullableText(dto.phone),
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      addressJson: dto.addressJson as Prisma.InputJsonValue | undefined,
      notes: this.nullableText(dto.notes),
      externalWorks: dto.externalWorks?.length
        ? {
            create: dto.externalWorks.map((work) => ({
              publicId: createPublicId('tex'),
              companyName: work.companyName,
              roleName: this.nullableText(work.roleName),
              schedule: this.nullableText(work.schedule),
              startsAt: work.startsAt ? new Date(work.startsAt) : null,
              endsAt: work.endsAt ? new Date(work.endsAt) : null,
              status: this.nullableText(work.status),
              notes: this.nullableText(work.notes)
            }))
          }
        : undefined
    };
  }

  private buildPersonUpdateData(dto: UpdatePersonDto): Prisma.PersonUpdateInput {
    return {
      name: dto.name,
      cpf: dto.cpf === undefined ? undefined : this.nullableText(dto.cpf),
      rg: dto.rg === undefined ? undefined : this.nullableText(dto.rg),
      email: dto.email === undefined ? undefined : this.nullableText(dto.email),
      phone: dto.phone === undefined ? undefined : this.nullableText(dto.phone),
      birthDate:
        dto.birthDate === undefined
          ? undefined
          : dto.birthDate
            ? new Date(dto.birthDate)
            : null,
      addressJson:
        dto.addressJson === undefined
          ? undefined
          : (dto.addressJson as Prisma.InputJsonValue),
      notes: dto.notes === undefined ? undefined : this.nullableText(dto.notes)
    };
  }

  private async ensurePersonExists(publicId: string) {
    const person = await this.prisma.person.findUnique({
      where: { publicId },
      select: { id: true }
    });

    if (!person) {
      throw new NotFoundException('Pessoa nao encontrada.');
    }
  }

  private nullableText(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
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
