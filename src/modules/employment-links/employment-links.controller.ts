import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { PrivilegedAccessGuard } from '../auth/guards/privileged-access.guard';
import { CreateDismissalDto } from './dto/create-dismissal.dto';
import { CreateEmploymentLinkDto } from './dto/create-employment-link.dto';
import { CreateEmploymentMoveDto } from './dto/create-employment-move.dto';
import { ListEmploymentLinksQueryDto } from './dto/list-employment-links-query.dto';
import { EmploymentLinksService } from './employment-links.service';

@ApiTags('vinculos')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('vinculos')
export class EmploymentLinksController {
  constructor(
    private readonly employmentLinksService: EmploymentLinksService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista vinculos com filtros operacionais e paginacao.'
  })
  list(@Query() query: ListEmploymentLinksQueryDto) {
    // Vinculo e o modulo que mais tende a puxar filtros compostos.
    // Vale manter naming previsivel aqui para o front nao nascer com parser proprio.
    return this.employmentLinksService.list(query);
  }

  @Get(':publicId')
  @ApiOperation({
    summary: 'Busca um vinculo com posto, contrato, movimentacoes e desligamento.'
  })
  findOne(@Param('publicId') publicId: string) {
    // O detalhe ja entrega contexto, historico e desfecho no mesmo payload.
    // Isso reduz roundtrip e evita o front remontar cronologia por conta propria.
    return this.employmentLinksService.findOne(publicId);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria um novo vinculo entre pessoa, prestadora, contrato e posto.'
  })
  create(@Body() dto: CreateEmploymentLinkDto) {
    // Aqui o front so envia referencias externas e dados de dominio.
    // A conciliacao entre pessoa, contrato e posto continua responsabilidade do backend.
    return this.employmentLinksService.create(dto);
  }

  @Post(':publicId/movimentacoes')
  @ApiOperation({
    summary: 'Registra uma movimentacao no historico do vinculo.'
  })
  createMove(
    @Param('publicId') publicId: string,
    @Body() dto: CreateEmploymentMoveDto
  ) {
    return this.employmentLinksService.createMove(publicId, dto);
  }

  @Post(':publicId/desligamento')
  @ApiOperation({
    summary: 'Registra o desligamento e fecha o vinculo.'
  })
  registerDismissal(
    @Param('publicId') publicId: string,
    @Body() dto: CreateDismissalDto
  ) {
    return this.employmentLinksService.registerDismissal(publicId, dto);
  }
}
