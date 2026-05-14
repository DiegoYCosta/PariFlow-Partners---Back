import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { FastifyReply, FastifyRequest } from "fastify";
import { buildRefreshCookieOptions } from "../../common/utils/cookie-options";
import { RefreshSessionDto } from "./dto/refresh-session.dto";
import { RequestCompanyAccessDto } from "./dto/request-company-access.dto";
import { SelectCompanyContextDto } from "./dto/select-company-context.dto";
import { SessionExchangeDto } from "./dto/session-exchange.dto";
import { StartSensitiveSessionDto } from "./dto/start-sensitive-session.dto";
import { UpdateCalendarPreferencesDto } from "./dto/update-calendar-preferences.dto";
import { UpdateCurrentUserDto } from "./dto/update-current-user.dto";
import { VerifySensitiveSessionDto } from "./dto/verify-sensitive-session.dto";
import { InternalAuthGuard } from "./guards/internal-auth.guard";
import { PrivilegedAccessGuard } from "./guards/privileged-access.guard";
import { AuthTokenPayload } from "./interfaces/auth-token-payload.interface";
import { AuthService } from "./auth.service";

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

type CookieRequest = FastifyRequest & {
  user?: AuthTokenPayload;
  cookies?: Record<string, string>;
};

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("session/exchange")
  @ApiOperation({
    summary: "Troca o Firebase ID Token por uma sessao interna inicial.",
  })
  async exchangeSession(
    @Body() dto: SessionExchangeDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    // Esse retorno precisa bastar para o bootstrap inicial da aplicacao.
    // Se faltar contexto aqui, o front nasce dependente de chamada extra logo apos login.
    const session = await this.authService.exchangeFirebaseSession(dto, {
      forwardedFor: request.headers["x-forwarded-for"],
      forwardedHost: request.headers["x-forwarded-host"],
      host: request.headers.host,
      origin: request.headers.origin,
      remoteAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    this.applyRefreshCookie(reply, session.refreshToken);
    return this.withoutRefreshToken(session);
  }

  @Get("me")
  @UseGuards(InternalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Retorna a sessao atual com perfis e contexto de seguranca.",
  })
  async me(@Req() request: AuthenticatedRequest) {
    // /me deve espelhar o retrato de sessao de forma estavel para reidratar
    // estado, reabrir aba e validar renovacao sem surpresas por modulo.
    return this.authService.getCurrentUser(request.user!);
  }

  @Patch("me")
  @UseGuards(InternalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Atualiza preferencias simples do usuario autenticado.",
  })
  async updateMe(
    @Body() dto: UpdateCurrentUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.updateCurrentUser(dto, request.user!);
  }

  @Get("access-context")
  @UseGuards(InternalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Retorna o contexto empresarial autenticado ou solicitacoes pendentes do proprio usuario.",
  })
  async accessContext(@Req() request: AuthenticatedRequest) {
    return this.authService.getAccessContext(request.user!);
  }

  @Post("company-context")
  @UseGuards(InternalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Seleciona uma empresa raiz ja aprovada e emite sessao interna escopada.",
  })
  async selectCompanyContext(
    @Body() dto: SelectCompanyContextDto,
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.authService.selectCompanyContext(
      dto,
      request.user!,
      request.cookies?.refresh_token,
      {
        forwardedFor: request.headers["x-forwarded-for"],
        forwardedHost: request.headers["x-forwarded-host"],
        host: request.headers.host,
        origin: request.headers.origin,
        remoteAddress: request.ip,
        userAgent: request.headers["user-agent"],
      },
    );

    this.applyRefreshCookie(reply, session.refreshToken);
    return this.withoutRefreshToken(session);
  }

  @Get("preferences/calendar")
  @UseGuards(InternalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Carrega preferencias de calendario do usuario no tenant autenticado.",
  })
  async getCalendarPreferences(@Req() request: AuthenticatedRequest) {
    return this.authService.getCalendarPreferences(request.user!);
  }

  @Patch("preferences/calendar")
  @UseGuards(InternalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Persiste preferencias de calendario do usuario no tenant autenticado.",
  })
  async updateCalendarPreferences(
    @Body() dto: UpdateCalendarPreferencesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.updateCalendarPreferences(dto, request.user!);
  }

  @Post("access-request")
  @UseGuards(InternalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Registra solicitacao autenticada de vinculo a empresa raiz sem liberar dados.",
  })
  async requestCompanyAccess(
    @Body() dto: RequestCompanyAccessDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.requestCompanyAccess(dto, request.user!, {
      forwardedFor: request.headers["x-forwarded-for"],
      forwardedHost: request.headers["x-forwarded-host"],
      host: request.headers.host,
      origin: request.headers.origin,
      remoteAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post("refresh")
  @ApiOperation({
    summary: "Rotaciona refresh token e emite novo access token.",
  })
  async refreshSession(
    @Body() dto: RefreshSessionDto | undefined,
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.authService.refreshSession(
      dto?.refreshToken ?? request.cookies?.refresh_token,
      {
        forwardedFor: request.headers["x-forwarded-for"],
        forwardedHost: request.headers["x-forwarded-host"],
        host: request.headers.host,
        origin: request.headers.origin,
        remoteAddress: request.ip,
        userAgent: request.headers["user-agent"],
      },
    );

    this.applyRefreshCookie(reply, session.refreshToken);
    return this.withoutRefreshToken(session);
  }

  @Post("logout")
  @ApiOperation({
    summary: "Revoga refresh token e encerra a sessao interna.",
  })
  async logout(
    @Body() dto: RefreshSessionDto | undefined,
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.authService.logout(
      dto?.refreshToken ?? request.cookies?.refresh_token,
    );
    reply.clearCookie("refresh_token", buildRefreshCookieOptions());
    return { loggedOut: true };
  }

  @Post("sensitive-session/start")
  @UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Inicia o fluxo de step-up para area sensivel.",
  })
  async startSensitiveSession(
    @Body() dto: StartSensitiveSessionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.startSensitiveSession(dto, request.user!, {
      forwardedFor: request.headers["x-forwarded-for"],
      forwardedHost: request.headers["x-forwarded-host"],
      host: request.headers.host,
      origin: request.headers.origin,
      remoteAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post("sensitive-session/verify")
  @UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Valida MFA ou fator adicional de sessao sensivel.",
  })
  async verifySensitiveSession(
    @Body() dto: VerifySensitiveSessionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.verifySensitiveSession(dto, request.user!, {
      forwardedFor: request.headers["x-forwarded-for"],
      forwardedHost: request.headers["x-forwarded-host"],
      host: request.headers.host,
      origin: request.headers.origin,
      remoteAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  private applyRefreshCookie(reply: FastifyReply, refreshToken?: string) {
    if (!refreshToken) {
      return;
    }

    reply.setCookie("refresh_token", refreshToken, buildRefreshCookieOptions());
  }

  private withoutRefreshToken<T extends { refreshToken?: string }>(
    session: T,
  ): Omit<T, "refreshToken"> {
    const { refreshToken: _refreshToken, ...safeSession } = session;
    return safeSession;
  }
}
