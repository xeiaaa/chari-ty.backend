import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateIntentDto {
  @IsString()
  fundraiserId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  alias?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
