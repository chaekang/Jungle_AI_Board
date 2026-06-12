import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

// 수정 DTO
export class UpdateSeatReviewDto {
  @IsOptional()
  @IsString()
  seatFloor?: string;

  @IsOptional()
  @IsString()
  seatSection?: string;

  @IsOptional()
  @IsString()
  seatRow?: string;

  @IsOptional()
  @IsString()
  seatNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  viewRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  soundRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  comfortRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  expressionRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  stageVisibilityRating?: number;

  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;
}
