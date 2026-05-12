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
import { ClientCompaniesService } from './client-companies.service';
import { CreateClientCompanyDto } from './dto/create-client-company.dto';
import { UpdateClientCompanyDto } from './dto/update-client-company.dto';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags('clientes')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('clientes')
export class ClientCompaniesController {
  constructor(
    @Inject(ClientCompaniesService)
    private readonly clientCompaniesService: ClientCompaniesService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista clientes contratantes com busca e paginacao.'
  })
  list(@Query() query: PaginationQueryDto, @Req() request: AuthenticatedRequest) {
    // Mantem o mesmo trilho de listagem dos demais cadastros para o front
    // reaproveitar busca, pagina e leitura de retorno sem if por modulo.
    return this.clientCompaniesService.list(query, request.user!);
  }

  @Get(':publicId')
  @ApiOperation({
    summary: 'Busca um cliente contratante pelo identificador publico.'
  })
  findOne(@Param('publicId') publicId: string, @Req() request: AuthenticatedRequest) {
    return this.clientCompaniesService.findOne(publicId, request.user!);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria um novo cliente contratante.'
  })
  create(@Body() dto: CreateClientCompanyDto, @Req() request: AuthenticatedRequest) {
    return this.clientCompaniesService.create(dto, request.user!);
  }

  @Patch(':publicId')
  @ApiOperation({
    summary: 'Atualiza um cliente contratante.'
  })
  update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateClientCompanyDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.clientCompaniesService.update(publicId, dto, request.user!);
  }

  @Delete(':publicId')
  @ApiOperation({
    summary: 'Inativa um cliente contratante sem apagar historico.'
  })
  remove(@Param('publicId') publicId: string, @Req() request: AuthenticatedRequest) {
    return this.clientCompaniesService.remove(publicId, request.user!);
  }
}
