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
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { PrivilegedAccessGuard } from '../auth/guards/privileged-access.guard';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { ListOccurrencesQueryDto } from './dto/list-occurrences-query.dto';
import { UpdateOccurrenceDto } from './dto/update-occurrence.dto';
import { OccurrencesService } from './occurrences.service';

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
  list(@Query() query: ListOccurrencesQueryDto) {
    return this.occurrencesService.list(query);
  }

  @Get(':publicId')
  @ApiOperation({
    summary:
      'Busca uma ocorrencia por publicId com suas relacoes operacionais imediatas.'
  })
  findOne(@Param('publicId') publicId: string) {
    return this.occurrencesService.findOne(publicId);
  }

  @Post()
  @ApiOperation({
    summary:
      'Cria uma ocorrencia validando pessoa, vinculo, prestadora e posto relacionados.'
  })
  create(@Body() dto: CreateOccurrenceDto) {
    return this.occurrencesService.create(dto);
  }

  @Patch(':publicId')
  @ApiOperation({
    summary:
      'Atualiza uma ocorrencia preservando consistencia entre pessoa, vinculo, prestadora e posto.'
  })
  update(@Param('publicId') publicId: string, @Body() dto: UpdateOccurrenceDto) {
    return this.occurrencesService.update(publicId, dto);
  }

  @Delete(':publicId')
  @ApiOperation({
    summary: 'Remove logicamente uma ocorrencia sem apagar anexos ou recibos.'
  })
  remove(@Param('publicId') publicId: string) {
    return this.occurrencesService.remove(publicId);
  }
}
