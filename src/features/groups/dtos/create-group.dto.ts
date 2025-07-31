import {
  IsString,
  IsOptional,
  IsEnum,
  IsUrl,
  IsArray,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { GroupType } from '../../../../generated/prisma';
import { Transform } from 'class-transformer';

/**
 * DTO for creating a new group
 */
export class CreateGroupDto {
  @IsString()
  @Transform(({ value }): string =>
    typeof value === 'string' ? value.trim() : String(value),
  )
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
  @IsString()
  avatarPublicId?: string;

  @IsOptional()
  @ValidateIf((o: CreateGroupDto) => !!o.website?.trim())
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }): string =>
    typeof value === 'string' ? value.trim() : String(value),
  )
  @MinLength(9, { message: 'EIN must be at least 9 characters' })
  @MaxLength(10, { message: 'EIN must be at most 10 characters' })
  @ValidateIf((o: CreateGroupDto) => o.type === 'nonprofit')
  ein?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsUrl({}, { each: true })
  documentsUrls?: string[];
}
