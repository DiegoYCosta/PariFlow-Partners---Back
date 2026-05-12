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
import { CalendarService } from './calendar.service';
import { CreateCalendarEntryDto } from './dto/create-calendar-entry.dto';
import { ListCalendarEntriesQueryDto } from './dto/list-calendar-entries-query.dto';
import { UpdateCalendarEntryDto } from './dto/update-calendar-entry.dto';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags('agenda')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('agenda')
export class CalendarController {
  constructor(
    @Inject(CalendarService)
    private readonly calendarService: CalendarService
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista compromissos e lembretes vinculados a pessoas, empresas ou contratos.'
  })
  list(
    @Query() query: ListCalendarEntriesQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarService.list(query, request.user!);
  }

  @Post()
  @ApiOperation({
    summary:
      'Cria compromisso ou lembrete com politica de notificacao e auditoria.'
  })
  create(
    @Body() dto: CreateCalendarEntryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarService.create(dto, request.user!);
  }

  @Patch(':publicId')
  @ApiOperation({
    summary:
      'Atualiza compromisso ou lembrete preservando publicId e recalculando notificacao.'
  })
  update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateCalendarEntryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarService.update(publicId, dto, request.user!);
  }

  @Delete(':publicId')
  @ApiOperation({
    summary: 'Cancela um compromisso ou lembrete sem apagar o historico.'
  })
  cancel(
    @Param('publicId') publicId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.calendarService.cancel(publicId, request.user!);
  }
}
