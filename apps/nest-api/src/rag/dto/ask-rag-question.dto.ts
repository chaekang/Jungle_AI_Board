import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AskRagQuestionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  question!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number = 5;
}
