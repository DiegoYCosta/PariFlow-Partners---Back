import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags
} from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { buildRefreshCookieOptions } from '../../common/utils/cookie-options';
import { SessionExchangeDto } from './dto/session-exchange.dto';
import { InternalAuthGuard } from './guards/internal-auth.guard';
import { AuthTokenPayload } from './interfaces/auth-token-payload.interface';
import { AuthService } from './auth.service';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('session/exchange')
  @ApiOperation({
    summary: 'Troca o Firebase ID Token por uma sessao interna inicial.'
  })
  async exchangeSession(
    @Body() dto: SessionExchangeDto,
    @Res({ passthrough: true }) _reply: FastifyReply
  ) {
    // Esse retorno precisa bastar para o bootstrap inicial da aplicacao.
    // Se faltar contexto aqui, o front nasce dependente de chamada extra logo apos login.
    return this.authService.exchangeFirebaseSession(dto);
  }

  @Get('me')
  @UseGuards(InternalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retorna a sessao atual com perfis e contexto de seguranca.'
  })
  async me(@Req() request: AuthenticatedRequest) {
    // /me deve espelhar o retrato de sessao de forma estavel para reidratar
    // estado, reabrir aba e validar renovacao sem surpresas por modulo.
    return this.authService.getCurrentUser(request.user!);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Endpoint reservado para refresh token rotativo.'
  })
  async refreshSession() {
    return this.authService.refreshSession();
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Endpoint reservado para logout e revogacao de sessao.'
  })
  async logout(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie('refresh_token', buildRefreshCookieOptions());
    return this.authService.logout();
  }

  @Post('sensitive-session/start')
  @ApiOperation({
    summary: 'Inicia o fluxo de step-up para area sensivel.'
  })
  async startSensitiveSession() {
    return this.authService.startSensitiveSession();
  }

  @Post('sensitive-session/verify')
  @ApiOperation({
    summary: 'Valida MFA ou fator adicional de sessao sensivel.'
  })
  async verifySensitiveSession() {
    return this.authService.verifySensitiveSession();
  }
}
