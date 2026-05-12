import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { InternalAuthGuard } from "../auth/guards/internal-auth.guard";
import { PrivilegedAccessGuard } from "../auth/guards/privileged-access.guard";
import { AuthTokenPayload } from "../auth/interfaces/auth-token-payload.interface";
import { DashboardService } from "./dashboard.service";

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags("dashboard")
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(
    @Inject(DashboardService)
    private readonly dashboardService: DashboardService,
  ) {}

  @Get("home")
  @ApiOperation({
    summary:
      "Retorna indicadores e linhas operacionais para a home sem criar dependencia de mock no front.",
  })
  home(
    @Query() query: Record<string, string | string[] | undefined>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.dashboardService.home(query, request.user!);
  }
}
