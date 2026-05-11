import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { InternalAuthGuard } from "../auth/guards/internal-auth.guard";
import { PrivilegedAccessGuard } from "../auth/guards/privileged-access.guard";
import { DashboardService } from "./dashboard.service";

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
  home(@Query() query: Record<string, string | string[] | undefined>) {
    return this.dashboardService.home(query);
  }
}
