import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { PrivilegedAccessGuard } from '../auth/guards/privileged-access.guard';
import { NetworkGraphQueryDto } from './dto/network-graph-query.dto';
import { NetworkService } from './network.service';

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
  graph(@Query() query: NetworkGraphQueryDto) {
    return this.networkService.graph(query);
  }
}
