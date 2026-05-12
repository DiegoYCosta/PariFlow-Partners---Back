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
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { PrivilegedAccessGuard } from '../auth/guards/privileged-access.guard';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { ListOccurrencesQueryDto } from './dto/list-occurrences-query.dto';
import { UpdateOccurrenceDto } from './dto/update-occurrence.dto';
import { OccurrencesService } from './occurrences.service';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags('ocorrencias')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('ocorrencias')
export class OccurrencesController {
  constructor(
    @Inject(OccurrencesService)
    private readonly occurrencesService: OccurrencesService
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista ocorrencias por pessoa, vinculo, prestadora, posto, natureza e visibilidade.'
  })
  list(@Query() query: ListOccurrencesQueryDto, @Req() request: AuthenticatedRequest) {
    return this.occurrencesService.list(query, request.user!);
  }

  @Get(':publicId')
  @ApiOperation({
    summary:
      'Busca uma ocorrencia por publicId com suas relacoes operacionais imediatas.'
  })
  findOne(@Param('publicId') publicId: string, @Req() request: AuthenticatedRequest) {
    return this.occurrencesService.findOne(publicId, request.user!);
  }

  @Post()
  @ApiOperation({
    summary:
      'Cria uma ocorrencia validando pessoa, vinculo, prestadora e posto relacionados.'
  })
  create(@Body() dto: CreateOccurrenceDto, @Req() request: AuthenticatedRequest) {
    return this.occurrencesService.create(dto, request.user!);
  }

  @Patch(':publicId')
  @ApiOperation({
    summary:
      'Atualiza uma ocorrencia preservando consistencia entre pessoa, vinculo, prestadora e posto.'
  })
  update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateOccurrenceDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.occurrencesService.update(publicId, dto, request.user!);
  }

  @Delete(':publicId')
  @ApiOperation({
    summary: 'Remove logicamente uma ocorrencia sem apagar anexos ou recibos.'
  })
  remove(@Param('publicId') publicId: string, @Req() request: AuthenticatedRequest) {
    return this.occurrencesService.remove(publicId, request.user!);
  }
}
