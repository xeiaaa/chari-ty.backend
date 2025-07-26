import { IsOptional, IsString, IsEnum, IsArray, IsUrl } from 'class-validator';
import { GroupType } from '../../../../generated/prisma';

/**
 * DTO for updating a group
 */
export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GroupType)
  type?: GroupType;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  ein?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentsUrls?: string[];
}
