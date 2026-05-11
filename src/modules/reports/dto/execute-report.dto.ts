import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

export class ExecuteReportDto {
  @ApiProperty({
    example: "management_employees",
    description:
      "Identificador do template escolhido na central de relatorios do front.",
  })
  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @ApiPropertyOptional({
    description:
      "Mapa de filtros do front. As chaves preservam o rotulo e o slot do filtro para evitar contrato paralelo.",
    example: {
      "Periodo::inicio": "01/05/2026",
      "Periodo::fim": "31/05/2026",
      "Status::valor": "Todos",
    },
  })
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      "Filtros marcados como obrigatorios no construtor visual do front.",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFilters?: string[];

  @ApiPropertyOptional({
    description: "Filtros marcados como opcionais no construtor visual do front.",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionalFilters?: string[];

  @ApiPropertyOptional({
    example: "Painel",
    description: "Saida escolhida no front: Painel, PDF, Planilha ou Email.",
  })
  @IsOptional()
  @IsString()
  delivery?: string;

  @ApiPropertyOptional({
    example: "Manual",
    description: "Frequencia visual escolhida para templates de automacao.",
  })
  @IsOptional()
  @IsString()
  frequency?: string;
}
