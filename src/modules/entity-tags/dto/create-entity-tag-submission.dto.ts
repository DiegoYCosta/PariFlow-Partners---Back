import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EntityTagClassification,
  EntityTagTargetType,
  SensitiveAudienceGroup
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from 'class-validator';

export class CreateEntityTagSubmissionDto {
  @ApiProperty({
    enum: EntityTagTargetType,
    description:
      'Tipo do alvo. Nesta primeira etapa o backend aceita pessoa e empresa prestadora.'
  })
  @IsEnum(EntityTagTargetType)
  targetType!: EntityTagTargetType;

  @ApiProperty({
    example: 'pes_01hxyzabc123def456ghi789',
    description:
      'publicId do alvo. O front continua referenciando pessoa ou empresa apenas por identificador publico.'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  targetPublicId!: string;

  @ApiProperty({
    example: 'usr_01hxyzabc123def456ghi789',
    description:
      'publicId do colaborador autenticado que sera tratado como dono do conteudo para leitura, edicao e exclusao futuras.'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  ownerUserPublicId!: string;

  @ApiProperty({
    example: 'costuma atrasar',
    description: 'Rotulo curto da tag operacional ou contextual.'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label!: string;

  @ApiProperty({
    example:
      'Historico informal de atrasos recorrentes no primeiro turno. Observacao sensivel para consulta autenticada.',
    description: 'Conteudo textual da anotacao. Limite maximo de 350 caracteres.'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(350)
  content!: string;

  @ApiProperty({
    enum: EntityTagClassification,
    description:
      'Classificacao da anotacao. Evita misturar observacao operacional com contexto pessoal ou familiar.'
  })
  @IsEnum(EntityTagClassification)
  classification!: EntityTagClassification;

  @ApiPropertyOptional({
    enum: SensitiveAudienceGroup,
    isArray: true,
    description:
      'Grupos de colaboradores autorizados a consultar a tag alem da autoria.'
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(SensitiveAudienceGroup, { each: true })
  allowedGroupKeys?: SensitiveAudienceGroup[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Lista opcional de colaboradores especificos autorizados a consultar a tag.'
  })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter((item) => typeof item === 'string' && item.length > 0)
      : value
  )
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(26, { each: true })
  allowedUserPublicIds?: string[];

  @ApiPropertyOptional({
    example: '#BF6B2D',
    description:
      'Cor visual da tag. O front pode padronizar tokens depois, mas o backend ja preserva a escolha.'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @Matches(/^#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/)
  @MaxLength(32)
  color?: string;

  @ApiPropertyOptional({
    example: 1,
    default: 0,
    description:
      'Ordem de exibicao da tag no detalhe. Quanto menor o valor, mais cedo ela aparece.'
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder = 0;
}