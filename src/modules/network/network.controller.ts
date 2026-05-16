import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { PrivilegedAccessGuard } from '../auth/guards/privileged-access.guard';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { NetworkGraphQueryDto } from './dto/network-graph-query.dto';
import { NetworkTimelineQueryDto } from './dto/network-timeline-query.dto';
import { NetworkService } from './network.service';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags('network')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('network')
export class NetworkController {
  constructor(
    @Inject(NetworkService) private readonly networkService: NetworkService
  ) {}

  @Get('graph')
  @ApiOperation({
    summary:
      'Retorna a teia relacional em lanes para prestadoras, clientes, contratos, postos e pessoas.'
  })
  graph(
    @Query() query: NetworkGraphQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.networkService.graph(query, request.user!);
  }

  @Get('timeline')
  @ApiOperation({
    summary:
      'Retorna a linha do tempo relacional em read model separado do grafo legado.'
  })
  timeline(
    @Query() query: NetworkTimelineQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.networkService.timeline(query, request.user!);
  }
}
