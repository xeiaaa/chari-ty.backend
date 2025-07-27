import {
  IsOptional,
  IsEnum,
  IsString,
  IsBoolean,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DonationStatus } from '../../../../generated/prisma';

export enum DonationSortField {
  createdAt = 'createdAt',
  updatedAt = 'updatedAt',
  amount = 'amount',
  status = 'status',
  name = 'name',
}

export enum SortOrder {
  asc = 'asc',
  desc = 'desc',
}

export class ListGroupDonationsDto {
  // Pagination
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // Sorting
  @IsOptional()
  @IsEnum(DonationSortField)
  sortBy?: DonationSortField = DonationSortField.createdAt;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.desc;

  // Filtering
  @IsOptional()
  @IsString()
  fundraiserId?: string;

  @IsOptional()
  @IsString()
  fundraiserLinkId?: string;

  @IsOptional()
  @IsDateString()
  updatedAt?: string;

  @IsOptional()
  @IsEnum(DonationStatus)
  @Transform(({ value }) => value?.toLowerCase())
  status?: DonationStatus;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsString()
  currency?: string;
}
