import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { PrivilegedAccessGuard } from '../auth/guards/privileged-access.guard';
import { CreateProviderCompanyDto } from './dto/create-provider-company.dto';
import { ProviderCompaniesService } from './provider-companies.service';

@ApiTags('empresas-prestadoras')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('empresas-prestadoras')
export class ProviderCompaniesController {
  constructor(
    private readonly providerCompaniesService: ProviderCompaniesService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista empresas prestadoras com busca e paginacao.'
  })
  list(@Query() query: PaginationQueryDto) {
    // Lista simples, mas com o mesmo contrato base das outras telas.
    // Filtro novo aqui precisa seguir query string previsivel para nao criar excecao no front.
    return this.providerCompaniesService.list(query);
  }

  @Get(':publicId')
  @ApiOperation({
    summary: 'Busca uma empresa prestadora pelo identificador publico.'
  })
  findOne(@Param('publicId') publicId: string) {
    return this.providerCompaniesService.findOne(publicId);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria uma nova empresa prestadora.'
  })
  create(@Body() dto: CreateProviderCompanyDto) {
    return this.providerCompaniesService.create(dto);
  }
}
