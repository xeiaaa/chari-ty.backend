import {
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  IsUrl,
  ValidateIf,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { GroupType } from '../../../../generated/prisma';
import { Transform } from 'class-transformer';

/**
 * DTO for updating a group
 */
export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1, { message: 'Name is required' })
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GroupType)
  type?: GroupType;

  @IsOptional()
  @IsString()
  avatarPublicId?: string;

  @IsOptional()
  @ValidateIf((o) => o.website !== '')
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(9, { message: 'EIN must be at least 9 characters' })
  @MaxLength(10, { message: 'EIN must be at most 10 characters' })
  ein?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentsUrls?: string[];

  @IsOptional()
  @IsBoolean()
  removeAvatar?: boolean;
}
