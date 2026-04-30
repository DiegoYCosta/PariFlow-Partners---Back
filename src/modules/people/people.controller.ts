import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { PrivilegedAccessGuard } from '../auth/guards/privileged-access.guard';
import { CreatePersonDto } from './dto/create-person.dto';
import { PeopleService } from './people.service';

@ApiTags('pessoas')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('pessoas')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista pessoas com busca simples e paginacao.'
  })
  list(@Query() query: PaginationQueryDto) {
    return this.peopleService.list(query);
  }

  @Get(':publicId')
  @ApiOperation({
    summary: 'Busca uma pessoa com trabalhos externos e resumo de vinculos.'
  })
  findOne(@Param('publicId') publicId: string) {
    // O detalhe de pessoa ja vem mais rico de proposito para sustentar ficha,
    // historico e dossie futuro sem costura de varias chamadas no front.
    return this.peopleService.findOne(publicId);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria uma pessoa com trabalhos externos opcionais.'
  })
  create(@Body() dto: CreatePersonDto) {
    return this.peopleService.create(dto);
  }
}
