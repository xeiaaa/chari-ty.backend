import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateMilestoneDto {
  @IsNumber()
  @Min(1, { message: 'Amount must be greater than 0' })
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  purpose: string;
}
