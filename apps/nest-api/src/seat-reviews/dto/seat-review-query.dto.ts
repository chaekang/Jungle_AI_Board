import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class SeatReviewQueryDto {
    @IsOptional()
    @IsString()
    theaterId?: string;

    @IsOptional()
    @IsString()
    musicalId?: string;

    @IsOptional()
    @IsString()
    performanceId?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number = 20;
}