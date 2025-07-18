import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsIn,
} from 'class-validator';
import {
  FundraiserCategory,
  FundraiserStatus,
} from '../../../../generated/prisma';

export class ListPublicFundraisersDto {
  @IsString()
  @IsOptional()
  groupId?: string;

  @IsEnum(FundraiserStatus)
  @IsOptional()
  status?: FundraiserStatus;

  @IsEnum(FundraiserCategory)
  @IsOptional()
  category?: FundraiserCategory;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  @IsIn(['createdAt', 'goalAmount'])
  sortBy?: string;

  @IsString()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsOptional()
  @Min(1)
  limit?: number;

  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number;
}
