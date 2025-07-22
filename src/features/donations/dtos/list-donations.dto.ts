import { IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { DonationStatus } from '../../../../generated/prisma';

export class ListDonationsDto {
  @IsOptional()
  @IsEnum(DonationStatus)
  @Transform(({ value }) => value?.toLowerCase())
  status?: DonationStatus;
}
