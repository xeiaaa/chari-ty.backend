import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUrl,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { FundraiserCategory } from '../../../../generated/prisma';

export class UpdateFundraiserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  summary?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  @IsOptional()
  description?: string;

  @IsEnum(FundraiserCategory)
  @IsNotEmpty()
  @IsOptional()
  category?: FundraiserCategory;

  @IsNumber()
  @Min(1, { message: 'Goal amount must be greater than 0' })
  @IsOptional()
  goalAmount?: number;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  currency?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsUrl()
  @IsNotEmpty()
  @IsOptional()
  coverUrl?: string;

  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  galleryUrls?: string[];

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
