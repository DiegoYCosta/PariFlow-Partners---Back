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
import { CreateContractPositionDto } from './dto/create-contract-position.dto';
import { CreateContractServiceDto } from './dto/create-contract-service.dto';
import { CreateContractTypeDto } from './dto/create-contract-type.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDocumentDto } from './dto/update-contract-document.dto';
import { UpdateContractModelDto } from './dto/update-contract-model.dto';
import { UpdateContractPositionDto } from './dto/update-contract-position.dto';
import { UpdateContractServiceDto } from './dto/update-contract-service.dto';
import { UpdateContractTypeDto } from './dto/update-contract-type.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

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

  @Get('servicos')
  @ApiOperation({
    summary: 'Lista servicos reutilizaveis para postos de contratos.'
  })
  listServices() {
    return this.contractsService.listServices();
  }

  @Post('servicos')
  @ApiOperation({
    summary: 'Cria um servico reutilizavel para postos de contratos.'
  })
  createService(@Body() dto: CreateContractServiceDto) {
    return this.contractsService.createService(dto);
  }

  @Patch('servicos/:servicePublicId')
  @ApiOperation({
    summary: 'Atualiza um servico reutilizavel sem apagar historico de postos.'
  })
  updateService(
    @Param('servicePublicId') servicePublicId: string,
    @Body() dto: UpdateContractServiceDto
  ) {
    return this.contractsService.updateService(servicePublicId, dto);
  }

  @Delete('servicos/:servicePublicId')
  @ApiOperation({
    summary: 'Inativa um servico reutilizavel.'
  })
  removeService(@Param('servicePublicId') servicePublicId: string) {
    return this.contractsService.removeService(servicePublicId);
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

  @Patch(':publicId')
  @ApiOperation({
    summary: 'Atualiza dados principais de um contrato.'
  })
  update(@Param('publicId') publicId: string, @Body() dto: UpdateContractDto) {
    return this.contractsService.update(publicId, dto);
  }

  @Delete(':publicId')
  @ApiOperation({
    summary: 'Inativa logicamente um contrato preservando vinculos historicos.'
  })
  remove(@Param('publicId') publicId: string) {
    return this.contractsService.remove(publicId);
  }

  @Get(':publicId/postos')
  @ApiOperation({
    summary: 'Lista postos/vagas de um contrato.'
  })
  listPositions(@Param('publicId') publicId: string) {
    return this.contractsService.listPositions(publicId);
  }

  @Post(':publicId/postos')
  @ApiOperation({
    summary: 'Cria um posto/vaga dentro de um contrato.'
  })
  createPosition(
    @Param('publicId') publicId: string,
    @Body() dto: CreateContractPositionDto
  ) {
    return this.contractsService.createPosition(publicId, dto);
  }

  @Patch('postos/:positionPublicId')
  @ApiOperation({
    summary: 'Atualiza um posto/vaga de contrato.'
  })
  updatePosition(
    @Param('positionPublicId') positionPublicId: string,
    @Body() dto: UpdateContractPositionDto
  ) {
    return this.contractsService.updatePosition(positionPublicId, dto);
  }

  @Delete('postos/:positionPublicId')
  @ApiOperation({
    summary: 'Inativa um posto/vaga preservando vinculos historicos.'
  })
  removePosition(@Param('positionPublicId') positionPublicId: string) {
    return this.contractsService.removePosition(positionPublicId);
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
