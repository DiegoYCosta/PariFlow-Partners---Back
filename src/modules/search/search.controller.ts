import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { PrivilegedAccessGuard } from '../auth/guards/privileged-access.guard';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { GlobalSearchQueryDto } from './dto/global-search-query.dto';
import { SearchService } from './search.service';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('search')
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Busca entidades autorizadas por tenant para o header global.'
  })
  search(
    @Query() query: GlobalSearchQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.searchService.search(query, request.user!);
  }
}
