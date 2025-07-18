import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsUrl,
} from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsString()
  fundraiserId: string;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  @IsOptional()
  alias?: string;

  @IsBoolean()
  @IsOptional()
  isAnonymous?: boolean;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsUrl()
  @IsOptional()
  successUrl?: string;

  @IsUrl()
  @IsOptional()
  cancelUrl?: string;
}
