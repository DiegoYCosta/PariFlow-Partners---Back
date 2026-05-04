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
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { PrivilegedAccessGuard } from '../auth/guards/privileged-access.guard';
import { ContractsService } from './contracts.service';
import { CreateContractDocumentDto } from './dto/create-contract-document.dto';
import { CreateContractModelDto } from './dto/create-contract-model.dto';
import { CreateContractTypeDto } from './dto/create-contract-type.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDocumentDto } from './dto/update-contract-document.dto';
import { UpdateContractModelDto } from './dto/update-contract-model.dto';
import { UpdateContractTypeDto } from './dto/update-contract-type.dto';

@ApiTags('contratos')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('contratos')
export class ContractsController {
  constructor(
    @Inject(ContractsService)
    private readonly contractsService: ContractsService
  ) {}

  @Get('tipos')
  @ApiOperation({
    summary: 'Lista tipos de contrato. Deve existir ao menos um ativo.'
  })
  listTypes() {
    return this.contractsService.listTypes();
  }

  @Post('tipos')
  @ApiOperation({
    summary: 'Cria um tipo de contrato para classificar contratos.'
  })
  createType(@Body() dto: CreateContractTypeDto) {
    return this.contractsService.createType(dto);
  }

  @Patch('tipos/:publicId')
  @ApiOperation({
    summary: 'Atualiza um tipo de contrato sem permitir zerar os tipos ativos.'
  })
  updateType(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateContractTypeDto
  ) {
    return this.contractsService.updateType(publicId, dto);
  }

  @Delete('tipos/:publicId')
  @ApiOperation({
    summary: 'Inativa um tipo de contrato sem apagar historico.'
  })
  removeType(@Param('publicId') publicId: string) {
    return this.contractsService.removeType(publicId);
  }

  @Get('modelos')
  @ApiOperation({
    summary:
      'Lista modelos reutilizaveis de contrato. Modelo compartilhado nao cria relacao entre empresas.'
  })
  listModels() {
    return this.contractsService.listModels();
  }

  @Post('modelos')
  @ApiOperation({
    summary: 'Cria um modelo reutilizavel de contrato.'
  })
  createModel(@Body() dto: CreateContractModelDto) {
    return this.contractsService.createModel(dto);
  }

  @Patch('modelos/:publicId')
  @ApiOperation({
    summary: 'Atualiza um modelo reutilizavel de contrato.'
  })
  updateModel(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateContractModelDto
  ) {
    return this.contractsService.updateModel(publicId, dto);
  }

  @Delete('modelos/:publicId')
  @ApiOperation({
    summary: 'Inativa um modelo reutilizavel de contrato.'
  })
  removeModel(@Param('publicId') publicId: string) {
    return this.contractsService.removeModel(publicId);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista contratos com busca e paginacao.'
  })
  list(@Query() query: PaginationQueryDto) {
    return this.contractsService.list(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria um novo contrato entre prestadora e cliente.'
  })
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Get(':publicId/documentos')
  @ApiOperation({
    summary: 'Lista documentos e links anexados ao contrato.'
  })
  listDocuments(@Param('publicId') publicId: string) {
    return this.contractsService.listDocuments(publicId);
  }

  @Post(':publicId/documentos')
  @ApiOperation({
    summary: 'Anexa metadados de arquivo, link ou referencia fisica ao contrato.'
  })
  createDocument(
    @Param('publicId') publicId: string,
    @Body() dto: CreateContractDocumentDto
  ) {
    return this.contractsService.createDocument(publicId, dto);
  }

  @Patch('documentos/:documentPublicId')
  @ApiOperation({
    summary: 'Atualiza metadados de documento ou link do contrato.'
  })
  updateDocument(
    @Param('documentPublicId') documentPublicId: string,
    @Body() dto: UpdateContractDocumentDto
  ) {
    return this.contractsService.updateDocument(documentPublicId, dto);
  }

  @Delete('documentos/:documentPublicId')
  @ApiOperation({
    summary: 'Remove logicamente documento ou link do contrato.'
  })
  removeDocument(@Param('documentPublicId') documentPublicId: string) {
    return this.contractsService.removeDocument(documentPublicId);
  }

  @Get(':publicId')
  @ApiOperation({
    summary: 'Busca um contrato pelo identificador publico.'
  })
  findOne(@Param('publicId') publicId: string) {
    return this.contractsService.findOne(publicId);
  }
}
