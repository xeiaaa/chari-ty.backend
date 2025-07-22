import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for creating a Stripe Connect account
 */
export class CreateConnectAccountDto {
  @IsString()
  @IsNotEmpty()
  groupId: string;
}
