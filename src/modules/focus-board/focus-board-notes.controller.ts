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
import { CreateFocusBoardNoteDto } from './dto/create-focus-board-note.dto';
import { CreateFocusBoardReminderDto } from './dto/create-focus-board-reminder.dto';
import { FocusBoardNoteTransitionDto } from './dto/focus-board-note-transition.dto';
import { ListFocusBoardNotesQueryDto } from './dto/list-focus-board-notes-query.dto';
import { UpdateFocusBoardNoteDto } from './dto/update-focus-board-note.dto';
import { FocusBoardNotesService } from './focus-board-notes.service';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags('focus-board')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('focus-board/notes')
export class FocusBoardNotesController {
  constructor(
    @Inject(FocusBoardNotesService)
    private readonly focusBoardNotesService: FocusBoardNotesService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista notas e tarefas autorizadas do Focus Board.'
  })
  list(
    @Query() query: ListFocusBoardNotesQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.focusBoardNotesService.list(query, request.user!);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria nota ou tarefa do Focus Board com contexto, ACL e auditoria.'
  })
  create(
    @Body() dto: CreateFocusBoardNoteDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.focusBoardNotesService.create(dto, request.user!);
  }

  @Get(':publicId/events')
  @ApiOperation({
    summary: 'Lista eventos de auditoria da nota ou tarefa autorizada.'
  })
  listEvents(
    @Param('publicId') publicId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.focusBoardNotesService.listEvents(publicId, request.user!);
  }

  @Post(':publicId/reminders')
  @ApiOperation({
    summary: 'Cria lembrete de agenda vinculado a uma nota ou tarefa.'
  })
  createReminder(
    @Param('publicId') publicId: string,
    @Body() dto: CreateFocusBoardReminderDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.focusBoardNotesService.createReminder(
      publicId,
      dto,
      request.user!
    );
  }

  @Delete(':publicId/reminders/:reminderPublicId')
  @ApiOperation({
    summary: 'Cancela lembrete de agenda vinculado a uma nota ou tarefa.'
  })
  cancelReminder(
    @Param('publicId') publicId: string,
    @Param('reminderPublicId') reminderPublicId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.focusBoardNotesService.cancelReminder(
      publicId,
      reminderPublicId,
      request.user!
    );
  }

  @Get(':publicId')
  @ApiOperation({
    summary: 'Busca detalhe autorizado de nota ou tarefa do Focus Board.'
  })
  findOne(
    @Param('publicId') publicId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.focusBoardNotesService.findOne(publicId, request.user!);
  }

  @Patch(':publicId')
  @ApiOperation({
    summary:
      'Atualiza campos omitidos de nota ou tarefa preservando dados existentes.'
  })
  update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateFocusBoardNoteDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.focusBoardNotesService.update(publicId, dto, request.user!);
  }

  @Post(':publicId/complete')
  @ApiOperation({
    summary: 'Conclui nota ou tarefa conforme permissao e modo de conclusao.'
  })
  complete(
    @Param('publicId') publicId: string,
    @Body() dto: FocusBoardNoteTransitionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.focusBoardNotesService.complete(publicId, dto, request.user!);
  }

  @Post(':publicId/reopen')
  @ApiOperation({
    summary: 'Reabre nota ou tarefa concluida.'
  })
  reopen(
    @Param('publicId') publicId: string,
    @Body() dto: FocusBoardNoteTransitionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.focusBoardNotesService.reopen(publicId, dto, request.user!);
  }

  @Post(':publicId/archive')
  @ApiOperation({
    summary: 'Arquiva nota ou tarefa sem apagar dados.'
  })
  archive(
    @Param('publicId') publicId: string,
    @Body() dto: FocusBoardNoteTransitionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.focusBoardNotesService.archive(publicId, dto, request.user!);
  }

  @Post(':publicId/trash')
  @ApiOperation({
    summary: 'Move nota ou tarefa para lixeira preservando auditoria.'
  })
  trash(
    @Param('publicId') publicId: string,
    @Body() dto: FocusBoardNoteTransitionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.focusBoardNotesService.trash(publicId, dto, request.user!);
  }

  @Post(':publicId/restore')
  @ApiOperation({
    summary: 'Restaura nota ou tarefa da lixeira.'
  })
  restore(
    @Param('publicId') publicId: string,
    @Body() dto: FocusBoardNoteTransitionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.focusBoardNotesService.restore(publicId, dto, request.user!);
  }

  @Delete(':publicId')
  @ApiOperation({
    summary: 'Remove logicamente nota ou tarefa apos passagem por lixeira.'
  })
  remove(
    @Param('publicId') publicId: string,
    @Body() dto: FocusBoardNoteTransitionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.focusBoardNotesService.remove(publicId, dto, request.user!);
  }
}
