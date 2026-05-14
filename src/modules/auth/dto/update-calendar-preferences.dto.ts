import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdateCalendarPreferencesDto {
  @ApiPropertyOptional({ enum: ["MONTH", "WEEK", "DAY", "LIST"] })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsIn(["MONTH", "WEEK", "DAY", "LIST"])
  defaultView?: string;

  @ApiPropertyOptional({ example: "7 dias" })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(40)
  overdueWindow?: string;

  @ApiPropertyOptional({
    example: { category: "TASK_REMINDER", appliesToStateCode: "SP" },
  })
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: { category: "OPERACIONAL", entityType: "PERSON" },
  })
  @IsOptional()
  @IsObject()
  timelineFilters?: Record<string, unknown>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  showNonBusinessDays?: boolean;
}

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}
