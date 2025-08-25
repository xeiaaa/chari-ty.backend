import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { VerificationStatus } from '../../../../generated/prisma';

/**
 * DTO for updating a group verification request (admin only)
 */
export class UpdateVerificationRequestDto {
  @IsEnum(VerificationStatus)
  status: VerificationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Reason must be at most 1000 characters' })
  @Transform(({ value }): string =>
    typeof value === 'string' ? value.trim() : String(value),
  )
  reason?: string;
}
