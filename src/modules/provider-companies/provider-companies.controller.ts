import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { PrivilegedAccessGuard } from '../auth/guards/privileged-access.guard';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { CreateProviderCompanyDto } from './dto/create-provider-company.dto';
import { UpdateProviderCompanyDto } from './dto/update-provider-company.dto';
import { ProviderCompaniesService } from './provider-companies.service';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags('empresas-prestadoras')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('empresas-prestadoras')
export class ProviderCompaniesController {
  constructor(
    @Inject(ProviderCompaniesService)
    private readonly providerCompaniesService: ProviderCompaniesService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista empresas prestadoras com busca e paginacao.'
  })
  list(@Query() query: PaginationQueryDto, @Req() request: AuthenticatedRequest) {
    // Lista simples, mas com o mesmo contrato base das outras telas.
    // Filtro novo aqui precisa seguir query string previsivel para nao criar excecao no front.
    return this.providerCompaniesService.list(query, request.user!);
  }

  @Get(':publicId')
  @ApiOperation({
    summary: 'Busca uma empresa prestadora pelo identificador publico.'
  })
  findOne(@Param('publicId') publicId: string, @Req() request: AuthenticatedRequest) {
    return this.providerCompaniesService.findOne(publicId, request.user!);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria uma nova empresa prestadora.'
  })
  create(@Body() dto: CreateProviderCompanyDto, @Req() request: AuthenticatedRequest) {
    return this.providerCompaniesService.create(dto, request.user!);
  }

  @Patch(':publicId')
  @ApiOperation({
    summary: 'Atualiza uma empresa prestadora.'
  })
  update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateProviderCompanyDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.providerCompaniesService.update(publicId, dto, request.user!);
  }

  @Delete(':publicId')
  @ApiOperation({
    summary: 'Inativa uma empresa prestadora sem apagar historico.'
  })
  remove(@Param('publicId') publicId: string, @Req() request: AuthenticatedRequest) {
    return this.providerCompaniesService.remove(publicId, request.user!);
  }
}
