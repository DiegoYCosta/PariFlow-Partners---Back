import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CreateEntityTagSubmissionDto } from './dto/create-entity-tag-submission.dto';
import { ListEntityTagsQueryDto } from './dto/list-entity-tags-query.dto';
import { UpdateEntityTagDto } from './dto/update-entity-tag.dto';
import { EntityTagsService } from './entity-tags.service';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags('tags-entidade')
@Controller('tags-entidade')
export class EntityTagsController {
  constructor(private readonly entityTagsService: EntityTagsService) {}

  @Post('submissions')
  @ApiOperation({
    summary:
      'Recebe submissao publica de tag sensivel para pessoa ou empresa prestadora.'
  })
  createSubmission(@Body() dto: CreateEntityTagSubmissionDto) {
    return this.entityTagsService.createSubmission(dto);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
  @ApiOperation({
    summary:
      'Cria uma tag sensivel com autoria autenticada para pessoa ou empresa prestadora.'
  })
  createInternal(
    @Body() dto: CreateEntityTagSubmissionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.entityTagsService.createInternal(dto, request.user!.sub);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(InternalAuthGuard)
  @ApiOperation({
    summary:
      'Lista tags ativas de uma pessoa ou empresa prestadora para usuario autenticado.'
  })
  list(@Query() query: ListEntityTagsQueryDto) {
    return this.entityTagsService.list(query);
  }

  @Get(':publicId')
  @ApiBearerAuth()
  @UseGuards(InternalAuthGuard)
  @ApiOperation({
    summary:
      'Busca uma tag de entidade pelo identificador publico para usuario autenticado.'
  })
  findOne(@Param('publicId') publicId: string) {
    return this.entityTagsService.findOne(publicId);
  }

  @Patch(':publicId')
  @ApiBearerAuth()
  @UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
  @ApiOperation({
    summary: 'Atualiza a classificacao, conteudo ou ordenacao de uma tag.'
  })
  update(@Param('publicId') publicId: string, @Body() dto: UpdateEntityTagDto) {
    return this.entityTagsService.update(publicId, dto);
  }

  @Delete(':publicId')
  @ApiBearerAuth()
  @UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
  @ApiOperation({
    summary: 'Remove logicamente uma tag de entidade.'
  })
  remove(
    @Param('publicId') publicId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.entityTagsService.remove(publicId, request.user!.sub);
  }
}
