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
import {
  FundraiserCategory,
  FundraiserOwnerType,
} from '../../../../generated/prisma';

export class CreateFundraiserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  summary: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @IsEnum(FundraiserCategory)
  @IsNotEmpty()
  category: FundraiserCategory;

  @IsNumber()
  @Min(1, { message: 'Goal amount must be greater than 0' })
  goalAmount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsUrl()
  @IsNotEmpty()
  coverUrl: string;

  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  galleryUrls?: string[];

  @IsEnum(FundraiserOwnerType)
  @IsNotEmpty()
  ownerType: FundraiserOwnerType;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  groupId?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
