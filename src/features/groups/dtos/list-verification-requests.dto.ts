import { IsOptional, IsEnum, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { VerificationStatus } from '../../../../generated/prisma';

/**
 * DTO for listing verification requests (admin only)
 */
export class ListVerificationRequestsDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }): string =>
    typeof value === 'string' ? value.trim() : String(value),
  )
  page?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }): string =>
    typeof value === 'string' ? value.trim() : String(value),
  )
  limit?: string;

  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;

  @IsOptional()
  @IsString()
  @Transform(({ value }): string =>
    typeof value === 'string' ? value.trim() : String(value),
  )
  groupName?: string;
}
