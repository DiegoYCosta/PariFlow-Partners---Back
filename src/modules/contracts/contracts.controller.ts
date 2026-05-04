import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { PrivilegedAccessGuard } from '../auth/guards/privileged-access.guard';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';

@ApiTags('contratos')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('contratos')
export class ContractsController {
  constructor(
    @Inject(ContractsService)
    private readonly contractsService: ContractsService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista contratos com busca e paginacao.'
  })
  list(@Query() query: PaginationQueryDto) {
    // Contrato lista por contexto de negocio, nao por join cru de banco.
    // Se entrar filtro novo, preservar esse desenho para a UI continuar legivel.
    return this.contractsService.list(query);
  }

  @Get(':publicId')
  @ApiOperation({
    summary: 'Busca um contrato pelo identificador publico.'
  })
  findOne(@Param('publicId') publicId: string) {
    return this.contractsService.findOne(publicId);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria um novo contrato entre prestadora e cliente.'
  })
  create(@Body() dto: CreateContractDto) {
    // O front sempre referencia prestadora e cliente por publicId ja carregado
    // nas listas anteriores; nao abrir excecao aqui para id interno.
    return this.contractsService.create(dto);
  }
}
