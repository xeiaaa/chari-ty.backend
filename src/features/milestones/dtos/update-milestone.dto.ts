import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class UpdateMilestoneDto {
  @IsNumber()
  @Min(1, { message: 'Amount must be greater than 0' })
  @IsOptional()
  amount?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @IsOptional()
  purpose?: string;
}
