import {
  IsString,
  IsOptional,
  IsEnum,
  IsUrl,
  IsArray,
  MinLength,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { GroupType } from '../../../../generated/prisma';
import { Transform, Type } from 'class-transformer';
import { CloudinaryAssetDto } from '../../../common/dtos/cloudinary-asset.dto';

/**
 * DTO for creating a new group
 */
export class CreateGroupDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must be at most 100 characters' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(GroupType)
  type: Exclude<GroupType, 'individual'>;

  @IsOptional()
  @ValidateNested()
  @Type(() => CloudinaryAssetDto)
  avatar?: CloudinaryAssetDto;

  @IsOptional()
  @ValidateIf((o) => o.avatarUrl !== '')
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @ValidateIf((o) => o.website !== '')
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(9, { message: 'EIN must be at least 9 characters' })
  @MaxLength(10, { message: 'EIN must be at most 10 characters' })
  @ValidateIf((o) => o.type === 'nonprofit')
  ein?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsUrl({}, { each: true })
  documentsUrls?: string[];
}
