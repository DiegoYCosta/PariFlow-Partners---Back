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
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PeopleService } from './people.service';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags('pessoas')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('pessoas')
export class PeopleController {
  constructor(
    @Inject(PeopleService) private readonly peopleService: PeopleService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista pessoas com busca simples e paginacao.'
  })
  list(@Query() query: PaginationQueryDto, @Req() request: AuthenticatedRequest) {
    return this.peopleService.list(query, request.user!);
  }

  @Get(':publicId')
  @ApiOperation({
    summary: 'Busca uma pessoa com trabalhos externos e resumo de vinculos.'
  })
  findOne(@Param('publicId') publicId: string, @Req() request: AuthenticatedRequest) {
    // O detalhe de pessoa ja vem mais rico de proposito para sustentar ficha,
    // historico e dossie futuro sem costura de varias chamadas no front.
    return this.peopleService.findOne(publicId, request.user!);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria uma pessoa com trabalhos externos opcionais.'
  })
  create(@Body() dto: CreatePersonDto, @Req() request: AuthenticatedRequest) {
    return this.peopleService.create(dto, request.user!);
  }

  @Patch(':publicId')
  @ApiOperation({
    summary: 'Atualiza o cadastro base da pessoa e seu historico externo.'
  })
  update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdatePersonDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.peopleService.update(publicId, dto, request.user!);
  }

  @Delete(':publicId')
  @ApiOperation({
    summary:
      'Remove uma pessoa sem vinculos, ocorrencias ou tags ja conectadas.'
  })
  remove(@Param('publicId') publicId: string, @Req() request: AuthenticatedRequest) {
    return this.peopleService.remove(publicId, request.user!);
  }
}
