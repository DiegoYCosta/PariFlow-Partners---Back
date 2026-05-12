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
import { CreateTimelineRecordDto } from './dto/create-timeline-record.dto';
import { ListTimelineRecordsQueryDto } from './dto/list-timeline-records-query.dto';
import { UpdateTimelineRecordDto } from './dto/update-timeline-record.dto';
import { TimelineService } from './timeline.service';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags('timeline')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('timeline')
export class TimelineController {
  constructor(
    @Inject(TimelineService)
    private readonly timelineService: TimelineService
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista registros operacionais mensais com vinculos opcionais e filtros.'
  })
  list(
    @Query() query: ListTimelineRecordsQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.timelineService.list(query, request.user!);
  }

  @Get(':publicId')
  @ApiOperation({
    summary: 'Busca um registro de timeline com seus vinculos.'
  })
  findOne(
    @Param('publicId') publicId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.timelineService.findOne(publicId, request.user!);
  }

  @Post()
  @ApiOperation({
    summary:
      'Cria registro mensal ou datado na timeline com vinculos opcionais.'
  })
  create(
    @Body() dto: CreateTimelineRecordDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.timelineService.create(dto, request.user!);
  }

  @Patch(':publicId')
  @ApiOperation({
    summary: 'Atualiza registro de timeline preservando publicId.'
  })
  update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateTimelineRecordDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.timelineService.update(publicId, dto, request.user!);
  }

  @Delete(':publicId')
  @ApiOperation({
    summary: 'Remove logicamente um registro de timeline.'
  })
  remove(
    @Param('publicId') publicId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.timelineService.remove(publicId, request.user!);
  }
}
