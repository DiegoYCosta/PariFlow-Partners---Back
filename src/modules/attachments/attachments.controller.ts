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
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { CreateAttachmentSubmissionDto } from './dto/create-attachment-submission.dto';
import { ListAttachmentsQueryDto } from './dto/list-attachments-query.dto';
import { UpdateAttachmentDto } from './dto/update-attachment.dto';
import { AttachmentsService } from './attachments.service';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags('anexos')
@Controller('anexos')
export class AttachmentsController {
  constructor(
    @Inject(AttachmentsService)
    private readonly attachmentsService: AttachmentsService
  ) {}

  @Post('submissions')
  @ApiOperation({
    summary:
      'Recebe submissao publica de anexo protegido ligado a uma ocorrencia.'
  })
  createSubmission(@Body() dto: CreateAttachmentSubmissionDto) {
    return this.attachmentsService.createSubmission(dto);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(InternalAuthGuard)
  @ApiOperation({
    summary:
      'Cria um anexo protegido com autoria autenticada, grupos e pessoas permitidas.'
  })
  createInternal(
    @Body() dto: CreateAttachmentSubmissionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.attachmentsService.createInternal(dto, request.user!);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(InternalAuthGuard)
  @ApiOperation({
    summary:
      'Lista anexos ativos e visiveis da ocorrencia para o colaborador autenticado.'
  })
  list(
    @Query() query: ListAttachmentsQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.attachmentsService.list(query, request.user!);
  }

  @Get(':publicId')
  @ApiBearerAuth()
  @UseGuards(InternalAuthGuard)
  @ApiOperation({
    summary:
      'Busca um anexo protegido por publicId respeitando autoria e compartilhamento.'
  })
  findOne(
    @Param('publicId') publicId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.attachmentsService.findOne(publicId, request.user!);
  }

  @Patch(':publicId')
  @ApiBearerAuth()
  @UseGuards(InternalAuthGuard)
  @ApiOperation({
    summary:
      'Atualiza metadados e compartilhamento de um anexo protegido respeitando a autoria autenticada.'
  })
  update(
    @Param('publicId') publicId: string,
    @Body() dto: UpdateAttachmentDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.attachmentsService.update(publicId, dto, request.user!);
  }

  @Delete(':publicId')
  @ApiBearerAuth()
  @UseGuards(InternalAuthGuard)
  @ApiOperation({
    summary: 'Remove logicamente um anexo protegido.'
  })
  remove(
    @Param('publicId') publicId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.attachmentsService.remove(publicId, request.user!);
  }
}
