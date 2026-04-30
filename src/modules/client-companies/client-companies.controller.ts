import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { PrivilegedAccessGuard } from '../auth/guards/privileged-access.guard';
import { ClientCompaniesService } from './client-companies.service';
import { CreateClientCompanyDto } from './dto/create-client-company.dto';

@ApiTags('clientes')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('clientes')
export class ClientCompaniesController {
  constructor(
    private readonly clientCompaniesService: ClientCompaniesService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista clientes contratantes com busca e paginacao.'
  })
  list(@Query() query: PaginationQueryDto) {
    // Mantem o mesmo trilho de listagem dos demais cadastros para o front
    // reaproveitar busca, pagina e leitura de retorno sem if por modulo.
    return this.clientCompaniesService.list(query);
  }

  @Get(':publicId')
  @ApiOperation({
    summary: 'Busca um cliente contratante pelo identificador publico.'
  })
  findOne(@Param('publicId') publicId: string) {
    return this.clientCompaniesService.findOne(publicId);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria um novo cliente contratante.'
  })
  create(@Body() dto: CreateClientCompanyDto) {
    return this.clientCompaniesService.create(dto);
  }
}
