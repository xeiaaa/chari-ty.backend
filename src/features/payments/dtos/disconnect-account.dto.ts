import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for disconnecting a Stripe Connect account
 */
export class DisconnectAccountDto {
  @IsString()
  @IsNotEmpty()
  groupId: string;
}
