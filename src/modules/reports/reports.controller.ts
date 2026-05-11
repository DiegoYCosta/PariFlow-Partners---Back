import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { InternalAuthGuard } from "../auth/guards/internal-auth.guard";
import { PrivilegedAccessGuard } from "../auth/guards/privileged-access.guard";
import { AuthTokenPayload } from "../auth/interfaces/auth-token-payload.interface";
import { ExecuteReportDto } from "./dto/execute-report.dto";
import { ReportsService } from "./reports.service";

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@ApiTags("relatorios")
@ApiBearerAuth()
@UseGuards(InternalAuthGuard, PrivilegedAccessGuard)
@Controller("relatorios")
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reportsService: ReportsService,
  ) {}

  @Post("executar")
  @ApiOperation({
    summary:
      "Executa relatorios operacionais, gerenciais, controles, compliance e auditoria quando houver dados implementados.",
  })
  execute(
    @Body() dto: ExecuteReportDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    return this.reportsService.execute(dto, request.user!);
  }
}
