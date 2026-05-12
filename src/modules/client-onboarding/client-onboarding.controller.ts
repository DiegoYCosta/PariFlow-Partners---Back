import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClientOnboardingService } from './client-onboarding.service';
import { CreateClientOnboardingDto } from './dto/create-client-onboarding.dto';

@ApiTags('public-client-onboarding')
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
}
