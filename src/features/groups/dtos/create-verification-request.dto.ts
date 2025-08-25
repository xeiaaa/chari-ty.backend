import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for creating a group verification request
 */
export class CreateVerificationRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Reason must be at most 1000 characters' })
  @Transform(({ value }): string =>
    typeof value === 'string' ? value.trim() : String(value),
  )
  reason?: string;
}
