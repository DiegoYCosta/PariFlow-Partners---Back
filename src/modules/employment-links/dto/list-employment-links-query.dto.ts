import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentLinkStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListEmploymentLinksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'pes_01hxyz...'
  })
  @IsOptional()
  @IsString()
  personPublicId?: string;

  @ApiPropertyOptional({
    example: 'epr_01hxyz...'
  })
  @IsOptional()
  @IsString()
  providerCompanyPublicId?: string;

  @ApiPropertyOptional({
    example: 'ctr_01hxyz...'
  })
  @IsOptional()
  @IsString()
  contractPublicId?: string;

  @ApiPropertyOptional({
    enum: EmploymentLinkStatus,
    example: EmploymentLinkStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(EmploymentLinkStatus)
  status?: EmploymentLinkStatus;

  @ApiPropertyOptional({
    example: 'CLT'
  })
  @IsOptional()
  @IsString()
  type?: string;
}
