import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClientOnboardingRequestStatus } from '@prisma/client';
import { FastifyRequest } from 'fastify';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';
import { PrivilegedAccessGuard } from '../auth/guards/privileged-access.guard';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { ClientOnboardingService } from './client-onboarding.service';
import { ReviewClientOnboardingDto } from './dto/review-client-onboarding.dto';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags('client-onboarding-admin')
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller('client-onboarding')
export class ClientOnboardingAdminController {
  constructor(
    @Inject(ClientOnboardingService)
    private readonly clientOnboardingService: ClientOnboardingService
  ) {}

  @Get('requests')
  @ApiOperation({
    summary: 'Lista solicitacoes de cadastro de cliente para analise interna.'
  })
  listRequests(@Query('status') status?: ClientOnboardingRequestStatus) {
    return this.clientOnboardingService.listRequests(status);
  }

  @Post('requests/:publicId/approve')
  @ApiOperation({
    summary: 'Aprova uma solicitacao de cadastro e libera a empresa raiz.'
  })
  approve(
    @Param('publicId') publicId: string,
    @Body() dto: ReviewClientOnboardingDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.clientOnboardingService.approveRequest(
      publicId,
      dto,
      request.user!
    );
  }

  @Post('requests/:publicId/reject')
  @ApiOperation({
    summary: 'Nega uma solicitacao de cadastro de cliente.'
  })
  reject(
    @Param('publicId') publicId: string,
    @Body() dto: ReviewClientOnboardingDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.clientOnboardingService.rejectRequest(
      publicId,
      dto,
      request.user!
    );
  }
}
