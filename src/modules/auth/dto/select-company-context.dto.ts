import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class SelectCompanyContextDto {
  @ApiProperty({ example: "org_abc123" })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  tenantRootCompanyPublicId!: string;
}

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}
