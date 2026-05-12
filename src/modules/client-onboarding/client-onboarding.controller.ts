import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClientOnboardingService } from './client-onboarding.service';
import { CreateClientOnboardingDto } from './dto/create-client-onboarding.dto';
import { StartClientOnboardingVerificationDto } from './dto/start-client-onboarding-verification.dto';
import { PublicOnboardingRateLimitGuard } from './public-onboarding-rate-limit.guard';

@ApiTags('public-client-onboarding')
@UseGuards(PublicOnboardingRateLimitGuard)
@Controller('public/client-onboarding')
export class ClientOnboardingController {
  constructor(
    @Inject(ClientOnboardingService)
    private readonly clientOnboardingService: ClientOnboardingService
  ) {}

  @Get('options')
  @ApiOperation({
    summary: 'Lista opcoes publicas para cadastro inicial de cliente.'
  })
  options() {
    return this.clientOnboardingService.getOptions();
  }

  @Get('cnpj-status')
  @ApiOperation({
    summary: 'Consulta o status comercial de um CNPJ para onboarding.'
  })
  checkCnpjByQuery(@Query('cnpj') cnpj: string) {
    return this.clientOnboardingService.checkCnpj(cnpj);
  }

  @Get('cnpj/:cnpj/status')
  @ApiOperation({
    summary: 'Consulta o status comercial de um CNPJ para onboarding.'
  })
  checkCnpjByPath(@Param('cnpj') cnpj: string) {
    return this.clientOnboardingService.checkCnpj(cnpj);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria solicitacao publica de cadastro de empresa raiz.'
  })
  create(@Body() dto: CreateClientOnboardingDto) {
    return this.clientOnboardingService.create(dto);
  }

  @Post('verification/start')
  @ApiOperation({
    summary: 'Gera codigo expirarivel para verificacao do cadastro publico.'
  })
  startVerification(@Body() dto: StartClientOnboardingVerificationDto) {
    return this.clientOnboardingService.startVerification(dto);
  }
}
